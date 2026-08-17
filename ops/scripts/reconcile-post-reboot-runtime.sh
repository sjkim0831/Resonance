#!/usr/bin/env bash
set -euo pipefail

namespace="${CARBONET_NAMESPACE:-carbonet-prod}"
manifest="${CARBONET_HAPROXY_CONFIG_MANIFEST:-/opt/resonance-data/control-plane/manifests/postgres-haproxy-config.yaml}"
deadline=$((SECONDS + 600))

recycle_deployment_pods_preserving_template() {
  local target_namespace="$1" deployment="$2" container="$3" timeout_seconds="$4"
  local max_pods="${CARBONET_POD_RECOVERY_MAX_PODS:-8}"
  local deployment_json deployment_uid deployment_template selector image expected_token
  local replicasets_json replicaset_inventory deployment_replicaset_uids replicaset_uids
  local pods_json pod_rows current_json current_token
  local fresh_pods_json
  local pod_entry pod_name pod_uid pod_json
  local -a recovery_pods=()

  [[ "$target_namespace" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ \
     && "$deployment" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ \
     && "$container" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ \
     && "$timeout_seconds" =~ ^[1-9][0-9]*$ && "$timeout_seconds" -le 600 \
     && "$max_pods" =~ ^[1-9][0-9]*$ && "$max_pods" -le 32 ]] || return 2

  deployment_json="$(kubectl -n "$target_namespace" get deployment "$deployment" -o json)" \
    || return 1
  jq -e --arg namespace "$target_namespace" --arg deployment "$deployment" \
      --arg container "$container" '
    .metadata.namespace==$namespace and .metadata.name==$deployment
    and (.metadata.uid|type=="string" and length>0)
    and ((.spec.selector.matchLabels//{})|type=="object" and length>0)
    and ((.spec.selector.matchExpressions//[])|length==0)
    and ([.spec.template.spec.containers[]?
      | select(.name==$container and (.image|type=="string" and length>0))]|length)==1
  ' <<<"$deployment_json" >/dev/null || return 1
  deployment_uid="$(jq -r '.metadata.uid' <<<"$deployment_json")"
  deployment_template="$(jq -cS '.spec.template
    | del(.metadata.labels["pod-template-hash"])' <<<"$deployment_json")"
  selector="$(jq -r '.spec.selector.matchLabels|to_entries|sort_by(.key)
    |map("\(.key)=\(.value)")|join(",")' <<<"$deployment_json")"
  image="$(jq -r --arg container "$container" \
    '.spec.template.spec.containers[]|select(.name==$container)|.image' \
    <<<"$deployment_json")"
  if [[ ! "$image" =~ @sha256:[0-9a-f]{64}$ ]]; then
    echo "[post-reboot] fail-closed: deployment/$deployment image is not digest-pinned; durable auto-deploy must publish an immutable PodTemplate (mutation=0)" >&2
    return 1
  fi
  expected_token="$(jq -cS '{uid:.metadata.uid,selector:.spec.selector,template:.spec.template}' \
    <<<"$deployment_json")"
  [[ -n "$selector" && -n "$expected_token" ]] || return 1

  replicasets_json="$(kubectl -n "$target_namespace" get replicasets -l "$selector" -o json)" \
    || return 1
  replicaset_inventory="$(jq -c --arg deployment_uid "$deployment_uid" \
      --argjson deployment_template "$deployment_template" '
    [.items[]
      | select(any(.metadata.ownerReferences[]?;
          .controller==true and .kind=="Deployment" and .uid==$deployment_uid))
      | {uid:.metadata.uid,
         exactTemplate:(.metadata.deletionTimestamp==null
           and ((.spec.template|del(.metadata.labels["pod-template-hash"]))==$deployment_template))}]
    | unique_by(.uid)
  ' <<<"$replicasets_json")" || return 1
  deployment_replicaset_uids="$(jq -c '[.[].uid]' <<<"$replicaset_inventory")"
  replicaset_uids="$(jq -c '[.[]|select(.exactTemplate)|.uid]' <<<"$replicaset_inventory")"
  jq -e 'length>0' <<<"$deployment_replicaset_uids" >/dev/null || return 1
  jq -e 'length>0' <<<"$replicaset_uids" >/dev/null || return 1

  pods_json="$(kubectl -n "$target_namespace" get pods -l "$selector" -o json)" || return 1
  if ! pod_rows="$(jq -r --argjson deployment_replicaset_uids "$deployment_replicaset_uids" \
      --argjson replicaset_uids "$replicaset_uids" \
      --arg container "$container" --arg image "$image" '
    [.items[]
      | select(.metadata.deletionTimestamp==null)
      | select(any(.metadata.ownerReferences[]?;
          .controller==true and .kind=="ReplicaSet"
          and (.uid as $owner_uid|$deployment_replicaset_uids|index($owner_uid)!=null)))
      | {name:.metadata.name,uid:.metadata.uid,
         exactTemplateOwner:any(.metadata.ownerReferences[]?;
           .controller==true and .kind=="ReplicaSet"
           and (.uid as $owner_uid|$replicaset_uids|index($owner_uid)!=null)),
         containerCount:([.spec.containers[]?|select(.name==$container)]|length),
         exactImage:(([.spec.containers[]?|select(.name==$container and .image==$image)]|length)==1)}
    ] as $owned
    | if (($owned|length)==0
        or any($owned[];(.exactTemplateOwner|not)
          or .containerCount!=1 or (.exactImage|not)))
      then error("owned pod image contract is not exact")
      else $owned|sort_by(.name)|.[]|[.name,.uid]|@tsv end
  ' <<<"$pods_json")"; then
    return 1
  fi
  mapfile -t recovery_pods <<<"$pod_rows"
  (( ${#recovery_pods[@]} >= 1 && ${#recovery_pods[@]} <= max_pods )) || return 1

  if [[ "${CARBONET_POD_RECOVERY_DRY_RUN:-false}" == true ]]; then
    echo "[post-reboot] same-template pod recovery DRY_RUN deployment=$deployment pods=${#recovery_pods[@]}"
    return 0
  fi
  [[ "${CARBONET_POD_RECOVERY_DRY_RUN:-false}" == false ]] || return 2

  for pod_entry in "${recovery_pods[@]}"; do
    IFS=$'\t' read -r pod_name pod_uid <<<"$pod_entry"
    [[ "$pod_name" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ \
       && "$pod_uid" =~ ^[0-9a-f-]{36}$ ]] || return 1
    current_json="$(kubectl -n "$target_namespace" get deployment "$deployment" -o json)" \
      || return 1
    current_token="$(jq -cS '{uid:.metadata.uid,selector:.spec.selector,template:.spec.template}' \
      <<<"$current_json")"
    [[ "$current_token" == "$expected_token" ]] || return 1

    fresh_pods_json="$(kubectl -n "$target_namespace" get pods -l "$selector" -o json)" \
      || return 1
    jq -e --arg pod_uid "$pod_uid" --arg container "$container" --arg image "$image" \
        --argjson deployment_replicaset_uids "$deployment_replicaset_uids" \
        --argjson replicaset_uids "$replicaset_uids" '
      [.items[]
        | select(.metadata.deletionTimestamp==null)
        | select(any(.metadata.ownerReferences[]?;
            .controller==true and .kind=="ReplicaSet"
            and (.uid as $owner_uid|$deployment_replicaset_uids|index($owner_uid)!=null)))
        | {uid:.metadata.uid,
           exactTemplateOwner:any(.metadata.ownerReferences[]?;
             .controller==true and .kind=="ReplicaSet"
             and (.uid as $owner_uid|$replicaset_uids|index($owner_uid)!=null)),
           valid:(([.spec.containers[]?|select(.name==$container)]|length)==1
             and ([.spec.containers[]?|select(.name==$container and .image==$image)]|length)==1),
           ready:any(.status.conditions[]?;.type=="Ready" and .status=="True")}
      ] as $owned
      | ($owned|map(select(.uid==$pod_uid))) as $target
      | ($owned|map(select(.uid!=$pod_uid and .valid and .ready))) as $ready_survivors
      | ($owned|length)>0 and all($owned[];.exactTemplateOwner and .valid)
        and ($target|length)==1
        and ((($target[0].ready)|not) or ($ready_survivors|length)>=1)
    ' <<<"$fresh_pods_json" >/dev/null || return 1

    pod_json="$(kubectl -n "$target_namespace" get pod "$pod_name" -o json)" || return 1
    jq -e --arg pod_uid "$pod_uid" --arg container "$container" --arg image "$image" \
        --argjson replicaset_uids "$replicaset_uids" '
      .metadata.uid==$pod_uid and .metadata.deletionTimestamp==null
      and ([.spec.containers[]?|select(.name==$container and .image==$image)]|length)==1
      and any(.metadata.ownerReferences[]?;
        .controller==true and .kind=="ReplicaSet"
        and (.uid as $owner_uid|$replicaset_uids|index($owner_uid)!=null))
    ' <<<"$pod_json" >/dev/null || return 1
    current_json="$(kubectl -n "$target_namespace" get deployment "$deployment" -o json)" \
      || return 1
    current_token="$(jq -cS '{uid:.metadata.uid,selector:.spec.selector,template:.spec.template}' \
      <<<"$current_json")"
    [[ "$current_token" == "$expected_token" ]] || return 1

    kubectl -n "$target_namespace" delete pod "$pod_name" --wait=true \
      --timeout="${timeout_seconds}s"
    kubectl -n "$target_namespace" rollout status "deployment/$deployment" \
      --timeout="${timeout_seconds}s"

    current_json="$(kubectl -n "$target_namespace" get deployment "$deployment" -o json)" \
      || return 1
    current_token="$(jq -cS '{uid:.metadata.uid,selector:.spec.selector,template:.spec.template}' \
      <<<"$current_json")"
    [[ "$current_token" == "$expected_token" ]] || return 1
  done
  echo "[post-reboot] same-template pod recovery PASS deployment=$deployment pods=${#recovery_pods[@]}"
}

kubectl_retry() {
  local attempt
  for attempt in $(seq 1 30); do
    if "$@"; then
      return 0
    fi
    echo "[post-reboot] Kubernetes mutation not ready; retry=$attempt/30" >&2
    sleep 5
  done
  return 1
}

main() {
  local desired available health
  until kubectl get node ccus >/dev/null 2>&1; do
    ((SECONDS < deadline)) || {
      echo "[post-reboot] Kubernetes API did not become ready" >&2
      exit 2
    }
    sleep 5
  done

  kubectl_retry kubectl apply -f "$manifest"
  desired="$(kubectl -n "$namespace" get deployment postgres-haproxy -o jsonpath='{.spec.replicas}')"
  available="$(kubectl -n "$namespace" get deployment postgres-haproxy -o jsonpath='{.status.availableReplicas}')"
  if [[ "${available:-0}" != "$desired" ]]; then
    kubectl_retry kubectl -n "$namespace" rollout restart deployment/postgres-haproxy
  fi
  kubectl -n "$namespace" rollout status deployment/postgres-haproxy --timeout=180s

  health="$(curl -fsS --max-time 10 http://127.0.0.1/actuator/health || true)"
  if [[ "$health" != *'"status":"UP"'* ]]; then
    recycle_deployment_pods_preserving_template "$namespace" carbonet-runtime \
      carbonet-runtime 240
    recycle_deployment_pods_preserving_template "$namespace" carbonet-web carbonet-web 180
  fi

  health="$(curl -fsS --max-time 10 http://127.0.0.1/actuator/health)"
  [[ "$health" == *'"status":"UP"'* ]]
  echo "POST_REBOOT_RUNTIME_RECOVERY_PASS"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi

#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("project_id")
    parser.add_argument("--image", required=True)
    parser.add_argument("--namespace", default="carbonet-prod")
    args = parser.parse_args()

    manifest_path = ROOT / "projects" / args.project_id / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    actual_id = manifest["metadata"]["projectId"]
    if actual_id != args.project_id:
        raise SystemExit(f"project id mismatch: {args.project_id} != {actual_id}")
    resource_id = re.sub(r"[^a-z0-9-]", "", args.project_id.lower().replace("_", "-"))
    if not resource_id:
        raise SystemExit("invalid Kubernetes resource id")
    app = f"{resource_id}-runtime"
    secret = f"{resource_id}-runtime-secret"
    configmap = f"{resource_id}-runtime-manifest"

    print(f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: {app}
  namespace: {args.namespace}
  labels:
    app: {app}
    framework: resonance
    project: {resource_id}
spec:
  replicas: 2
  minReadySeconds: 10
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: {app}
  template:
    metadata:
      labels:
        app: {app}
        framework: resonance
        project: {resource_id}
    spec:
      terminationGracePeriodSeconds: 60
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
        - name: runtime
          image: {args.image}
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 8080
          envFrom:
            - secretRef:
                name: {secret}
          env:
            - name: PROJECT_ID
              value: {args.project_id}
            - name: APP_PROJECT_ID
              value: {args.project_id}
            - name: SERVER_PORT
              value: "8080"
            - name: SPRING_PROFILES_ACTIVE
              value: prod
            - name: TOKEN_ACCESS_SECRET
              valueFrom:
                secretKeyRef:
                  name: carbonet-runtime-secret
                  key: TOKEN_ACCESS_SECRET
            - name: TOKEN_REFRESH_SECRET
              valueFrom:
                secretKeyRef:
                  name: carbonet-runtime-secret
                  key: TOKEN_REFRESH_SECRET
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 10"]
          startupProbe:
            httpGet:
              path: /actuator/health/liveness
              port: http
            failureThreshold: 60
            periodSeconds: 5
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: http
            periodSeconds: 5
            timeoutSeconds: 3
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: http
            periodSeconds: 15
            timeoutSeconds: 3
          resources:
            requests:
              cpu: 250m
              memory: 768Mi
            limits:
              cpu: "2"
              memory: 3Gi
          volumeMounts:
            - name: runtime-manifest
              mountPath: /app/config/manifest.json
              subPath: manifest.json
              readOnly: true
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: runtime-manifest
          configMap:
            name: {configmap}
        - name: tmp
          emptyDir:
            sizeLimit: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: {app}
  namespace: {args.namespace}
spec:
  selector:
    app: {app}
  ports:
    - name: http
      port: 80
      targetPort: http
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {app}-pdb
  namespace: {args.namespace}
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: {app}
""")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

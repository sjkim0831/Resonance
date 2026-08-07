def row_key($row): ($row.endpointCode + "\u0000" + $row.remoteHash);

($endpoints | sort) as $requiredEndpoints
| ($baseline[0]
    | map(select(.windowBucket == $bucket
        and (.endpointCode as $endpoint | ($endpoints | index($endpoint)) != null)))
    | map({key: row_key(.), value: .requestCount})
    | from_entries) as $baselineByKey
| ($current[0]
    | map(select(.windowBucket == $bucket
        and (.endpointCode as $endpoint | ($endpoints | index($endpoint)) != null)))
    | map(. + {
        baselineCount: ($baselineByKey[row_key(.)] // 0),
        delta: (.requestCount - ($baselineByKey[row_key(.)] // 0))
      })) as $rows
| ($rows | map(select(.delta == $ownedDelta))) as $ownedCandidates
| if (($ownedCandidates | length) == ($endpoints | length)
      and (($ownedCandidates | map(.endpointCode) | sort) == $requiredEndpoints)
      and (($ownedCandidates | map(.remoteHash) | unique | length) == 1))
  then {
    remoteHash: $ownedCandidates[0].remoteHash,
    windowBucket: $bucket,
    ownedDelta: $ownedDelta,
    rows: ($ownedCandidates | sort_by(.endpointCode))
  }
  else error("browser rate-limit candidate is not unique across all required endpoints")
  end

#!/bin/bash
# databases.txt GUARDIAN - 항상 보존
POD="cubrid-carbonet-0"
NS="carbonet-prod"
HOST_DB="/opt/Resonance/data/cubrid/databases"
POD_DB="/var/lib/cubrid/databases"
CUBRID_DB="/home/cubrid/CUBRID/databases"
BIN="/home/cubrid/CUBRID/bin"

# databases.txt 내용 정의
DATABASES_TXT_CONTENT="carbonet	${POD_DB}	localhost	${POD_DB}	file:${POD_DB}/lob"

ensure_databases_txt() {
    # 1. 호스트에 databases.txt 보존
    echo -e "$DATABASES_TXT_CONTENT" > "$HOST_DB/databases.txt"
    chmod 666 "$HOST_DB/databases.txt"
    
    # 2. Pod databases.txt가 없으면 생성
    if ! kubectl exec "$POD" -n "$NS" -- test -f "$POD_DB/databases.txt" 2>/dev/null; then
        kubectl exec "$POD" -n "$NS" -- bash -c "printf '%s\n' \"$DATABASES_TXT_CONTENT\" > $POD_DB/databases.txt"
    fi
    
    # 3. CUBRID 설치 디렉토리에도 복사
    kubectl exec "$POD" -n "$NS" -- bash -c "mkdir -p $CUBRID_DB && printf '%s\n' \"$DATABASES_TXT_CONTENT\" > $CUBRID_DB/databases.txt"
}

# 사용법
case "${1:-ensure}" in
    ensure) ensure_databases_txt ;;
    check)
        # 확인
        echo "Host databases.txt:"
        cat "$HOST_DB/databases.txt" 2>/dev/null || echo "없음"
        echo "Pod databases.txt:"
        kubectl exec "$POD" -n "$NS" -- cat "$POD_DB/databases.txt" 2>/dev/null || echo "없음"
        ;;
esac

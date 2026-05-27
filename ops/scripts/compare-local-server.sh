#!/bin/bash
# 로컬 vs 서버 파일 비교 유틸
# 사용법: ./compare-local-server.sh <user@host> <remote-path> <local-path>

USER_HOST=$1
REMOTE_PATH=$2
LOCAL_PATH=$3

if [ -z "$USER_HOST" ] || [ -z "$REMOTE_PATH" ] || [ -z "$LOCAL_PATH" ]; then
    echo "사용법: $0 <user@host> <remote_path> <local_path>"
    echo "예: $0 sjkim@172.16.1.232 /opt/Resonance/file.tsx ./file.tsx"
    exit 1
fi

echo "=========================================="
echo "로컬 vs 서버 파일 비교"
echo "=========================================="

# 로컬 파일 체크섬
if [ -f "$LOCAL_PATH" ]; then
    LOCAL_MD5=$(md5sum "$LOCAL_PATH" 2>/dev/null | awk '{print $1}')
    echo "로컬 MD5: $LOCAL_MD5"
    echo "로컬 수정: $(stat -c %y "$LOCAL_PATH" 2>/dev/null || stat -f %Sm "$LOCAL_PATH" 2>/dev/null)"
else
    echo "로컬 파일 없음: $LOCAL_PATH"
    LOCAL_MD5="NONE"
fi

# 서버 파일 체크섬
SERVER_MD5=$(ssh -o StrictHostKeyChecking=no "$USER_HOST" "md5sum $REMOTE_PATH 2>/dev/null | awk '{print \$1}'")
echo "서버 MD5: $SERVER_MD5"
SERVER_MOD=$(ssh -o StrictHostKeyChecking=no "$USER_HOST" "stat -c %y $REMOTE_PATH 2>/dev/null || stat -f %Sm $REMOTE_PATH 2>/dev/null")
echo "서버 수정: $SERVER_MOD"

# 비교
echo ""
if [ "$LOCAL_MD5" = "$SERVER_MD5" ]; then
    echo ">>> 상태: 동일함 ✓ <<<"
else
    echo ">>> 상태: 다름 ✗ <<<"
    echo ""
    echo ">>> 서버 -> 로컬 다운로드 필요 <<<"
fi

echo "=========================================="
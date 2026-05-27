#!/bin/bash
# 서버에서 파일을 가져오고 수정 후 배포하는 유틸리티
# 사용법: ./server-file-util.sh <action> <user@host> <remote_path> <local_path>

ACTION=$1
USER_HOST=$2
REMOTE_PATH=$3
LOCAL_PATH=$4

if [ -z "$ACTION" ] || [ -z "$USER_HOST" ] || [ -z "$REMOTE_PATH" ] || [ -z "$LOCAL_PATH" ]; then
    echo "사용법: $0 <action> <user@host> <remote_path> <local_path>"
    echo "  action: download, upload, backup, restore-git"
    echo "  example: $0 download sjkim@172.16.1.232 /path/to/file.txt ./local/file.txt"
    exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no"

case $ACTION in
    download)
        echo "서버에서 파일 다운로드: $REMOTE_PATH -> $LOCAL_PATH"
        scp $SSH_OPTS "$USER_HOST:$REMOTE_PATH" "$LOCAL_PATH"
        ;;
    upload)
        echo "로컬 파일을 서버에 업로드: $LOCAL_PATH -> $REMOTE_PATH"
        cat "$LOCAL_PATH" | ssh $SSH_OPTS "$USER_HOST" "cat > $REMOTE_PATH"
        ;;
    backup)
        BACKUP_PATH="${LOCAL_PATH}.backup.$(date +%Y%m%d%H%M%S)"
        echo "백업 생성: $LOCAL_PATH -> $BACKUP_PATH"
        cp "$LOCAL_PATH" "$BACKUP_PATH"
        ;;
    restore-git)
        echo "Git에서 파일 복원 시도..."
        read -p "Git 커밋 해시를 입력하세요: " COMMIT_HASH
        if [ -n "$COMMIT_HASH" ]; then
            git checkout "$COMMIT_HASH" -- "$LOCAL_PATH"
            echo "복원 완료: $LOCAL_PATH"
        else
            echo "커밋 해시가 입력되지 않았습니다."
        fi
        ;;
    *)
        echo "알 수 없는 action: $ACTION"
        exit 1
        ;;
esac

echo "완료"
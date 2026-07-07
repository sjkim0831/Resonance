# Omniverse + VNC 원격 접속 설정 계획

## 목표
- Windows에서 Ubuntu 원격 GUI 접속 (VNC)
- Omniverse Kit App Template 실행 환경 구성

## 작업 목록

### 1. VNC 서버 설치 및 구성
- [ ] TigerVNC 서버 설치
- [ ] VNC 접속 비밀번호 설정
- [ ] xstartup 스크립트 구성 (GNOME/XFCE 세션)
- [ ] VNC 서비스 활성화 및 시작

### 2. 네트워크/방화벽 확인
- [ ] VNC 포트 (5901) 열기 확인

### 3. Windows 클라이언트 설정
- [ ] TightVNC 뷰어 설치 안내

### 4. Omniverse 앱 생성 및 검증
- [ ] kit-app-template으로 Kit Base Editor 생성
- [ ] 빌드 및 실행 테스트

## 기술 세부사항

### VNC 서버 구성
- 디스플레이: `:1` (포트 5901)
- 세션 유형: xstartup (GDM 미사용, 직접 X 세션)

### 접속 정보
- IP: `hostname -I`로 확인
- 포트: 5901
- 비밀번호: 사용자가 설정

## 검증
- Windows TightVNC로 접속 후 GNOME/XFCE 데스크톱 표시
- `./repo.sh launch`로 Kit Base Editor 실행 확인
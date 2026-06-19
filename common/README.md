# Common Module - 공통 코드

공통으로 사용되는 UI 컴포넌트, AI 모듈, 테마 시스템을 포함합니다.

## 구조

```
common/
├── ui/                    # 공통 UI 컴포넌트 & 테마
│   ├── components/        # 재사용 가능한 UI 컴포넌트
│   │   ├── Button/       # 버튼
│   │   ├── Card/         # 카드
│   │   ├── Form/         # 입력필드 (Input, Label, Select)
│   │   ├── Modal/        # 모달
│   │   └── Table/        # 테이블
│   ├── themes/           # 테마 정의 (default, dark, corporate, minimal)
│   ├── providers/        # React Context Providers
│   ├── hooks/            # 커스텀 Hooks
│   └── index.ts          # exports
│
└── ai/                    # 공통 AI 기능
    ├── nvidia_client.py  # NVIDIA API 클라이언트 (16 keys)
    ├── config.yaml       # AI 설정
    └── __init__.py
```

## 사용법

### 1. ThemeProvider 설정

```tsx
import { ThemeProvider, Button, Card, useTheme } from './common/ui';

function App() {
  return (
    <ThemeProvider defaultTheme="default">
      <MyApp />
    </ThemeProvider>
  );
}
```

### 2. 테마 지원 컴포넌트

```tsx
import { Button, Card, Modal, Table, Input, Label } from './common/ui';

function MyComponent() {
  const { theme, themeId, setTheme } = useTheme();
  
  return (
    <Card>
      <h1>{themeId} 테마</h1>
      
      {/* 자동 테마 적용 */}
      <Button variant="primary">기본 버튼</Button>
      <Button variant="secondary"> secondary </Button>
      
      <Table>
        <Thead>
          <Tr><Th>이름</Th><Th>값</Th></Tr>
        </Thead>
        <Tbody>
          <Tr><Td>테스트</Td><Td>값</Td></Tr>
        </Tbody>
      </Table>
      
      {/* Modal 예제 */}
      <Modal isOpen={true} title="제목" onClose={() => {}}>
        <p>내용</p>
      </Modal>
      
      {/* Form 예제 */}
      <Label>이름</Label>
      <Input placeholder="입력하세요" />
    </Card>
  );
}
```

### 3. 테마 전환

```tsx
function ThemeSwitcher() {
  const { themeId, setTheme } = useTheme();
  
  return (
    <select value={themeId} onChange={(e) => setTheme(e.target.value)}>
      <option value="default">기본</option>
      <option value="dark">다크</option>
      <option value="corporate">기업</option>
      <option value="minimal">미니멀</option>
    </select>
  );
}
```

### 4. NVIDIA API 클라이언트 (Python)

```python
from common.ai import get_client

client = get_client()
response = client.call("안녕하세요")
print(response.content)
```

## 테마 추가 방법

1. `/common/ui/themes/`에 JSON 파일 생성
2. `index.ts`의 themes 객체에 추가

```json
{
  "id": "custom",
  "name": "커스텀 테마",
  "colors": { ... },
  "fonts": { ... },
  "components": { ... }
}
```

## 제공되는 테마

| ID | 이름 | 용도 |
|----|------|------|
| default | 기본 테마 | 일반적인 웹 앱 |
| dark | 다크 테마 | 야간 작업 |
| corporate | 기업 테마 | 기업용Formal |
| minimal | 미니멀 테마 | 깔끔한 디자인 |

UPDATE ai_prompt_template
SET model_name='gemma4-e4b-gpu-shadow',
    description='KRDS RAG와 정적 접근성 게이트를 사용하는 화면·컴포넌트 코드 생성 프롬프트. 전용 모델은 CARBONET_KRDS_AI_* 환경변수로 교체한다.',
    last_updt_pnttm=current_timestamp
WHERE prompt_type='KRDS_CODE_GENERATION' AND active_yn='Y';

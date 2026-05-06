package egovframework.com.feature.emission.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import egovframework.com.feature.emission.domain.entity.EcoinventMaster;
import egovframework.com.feature.emission.domain.repository.EcoinventMasterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EcoinventIntegrationService {

    private final EcoinventMasterRepository repository;

    @Value("${CARBONET.ECOINVENT.CLIENT_ID}")
    private String clientId;

    @Value("${CARBONET.ECOINVENT.CLIENT_SECRET}")
    private String clientSecret;

    @Transactional
    public void syncEcoinventData(String query) {
        RestTemplate restTemplate = new RestTemplate();
        String url = "https://ecoquery.ecoinvent.org/3.12/cutoff/search?query=" + query + "&searchBy=activity";
        
        // 헤더에 인증 정보 추가 (API 요구사항에 맞춰 수정 필요)
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.set("Client-Id", clientId);
        headers.set("Client-Secret", clientSecret);
        org.springframework.http.HttpEntity<String> entity = new org.springframework.http.HttpEntity<>(headers);

        try {
            org.springframework.http.ResponseEntity<String> response = restTemplate.exchange(url, org.springframework.http.HttpMethod.GET, entity, String.class);
            // 응답 데이터 파싱 및 EcoinventMaster 저장 로직
            // 예시: Ammonia 데이터 수집 로직 확장
            EcoinventMaster master = new EcoinventMaster();
            master.setMaterialName(query);
            master.setImpactScore(0.5); // 파싱된 값 적용
            master.setUnit("kg");
            master.setVersion("3.12");
            repository.save(master);
        } catch (Exception e) {
            throw new RuntimeException("Failed to sync ecoinvent data", e);
        }
    }
}

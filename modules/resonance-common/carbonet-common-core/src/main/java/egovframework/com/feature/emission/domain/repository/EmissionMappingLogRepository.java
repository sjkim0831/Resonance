package egovframework.com.feature.emission.domain.repository;

import egovframework.com.feature.emission.domain.entity.EmissionMappingLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmissionMappingLogRepository extends JpaRepository<EmissionMappingLog, Long> {
    List<EmissionMappingLog> findTop100ByRawMaterialNameContainingIgnoreCaseOrderByIdDesc(String rawMaterialName);

    List<EmissionMappingLog> findTop100ByRawMaterialNameIgnoreCaseOrderByIdDesc(String rawMaterialName);
}

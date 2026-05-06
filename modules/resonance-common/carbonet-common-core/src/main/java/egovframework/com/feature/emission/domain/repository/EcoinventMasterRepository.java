package egovframework.com.feature.emission.domain.repository;

import egovframework.com.feature.emission.domain.entity.EcoinventMaster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EcoinventMasterRepository extends JpaRepository<EcoinventMaster, Long> {
    List<EcoinventMaster> findTop100ByOrderByMaterialNameAsc();

    List<EcoinventMaster> findTop100ByMaterialNameContainingIgnoreCaseOrderByMaterialNameAsc(String materialName);
}

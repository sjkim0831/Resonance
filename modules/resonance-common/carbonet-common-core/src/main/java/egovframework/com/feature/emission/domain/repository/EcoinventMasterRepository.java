package egovframework.com.feature.emission.domain.repository;

import egovframework.com.feature.emission.domain.entity.EcoinventMaster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EcoinventMasterRepository extends JpaRepository<EcoinventMaster, Long> {
}

package egovframework.com.feature.emission.domain.repository;

import egovframework.com.feature.emission.domain.entity.EcoinventMaster;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EcoinventMasterRepository extends JpaRepository<EcoinventMaster, Long> {
    @Query("select coalesce(max(e.id), 0) from EcoinventMaster e")
    long findMaxId();

    List<EcoinventMaster> findTop100ByOrderByMaterialNameAsc();

    List<EcoinventMaster> findTop100ByMaterialNameContainingIgnoreCaseOrderByMaterialNameAsc(String materialName);

    @Query("""
            select e
            from EcoinventMaster e
            where (:keyword = ''
                or lower(coalesce(e.materialName, '')) like lower(concat('%', :keyword, '%'))
                or lower(coalesce(e.activityName, '')) like lower(concat('%', :keyword, '%'))
                or lower(coalesce(e.productName, '')) like lower(concat('%', :keyword, '%'))
                or lower(coalesce(e.activityType, '')) like lower(concat('%', :keyword, '%'))
                or lower(coalesce(e.timePeriod, '')) like lower(concat('%', :keyword, '%'))
                or lower(coalesce(e.referenceProductUnit, '')) like lower(concat('%', :keyword, '%'))
                or lower(coalesce(e.unit, '')) like lower(concat('%', :keyword, '%'))
                or lower(coalesce(e.scoreUnit, '')) like lower(concat('%', :keyword, '%'))
                or lower(coalesce(e.indicatorName, '')) like lower(concat('%', :keyword, '%')))
              and (:geography = ''
                or lower(coalesce(e.geography, '')) like lower(concat('%', :geography, '%')))
              and (:unit = ''
                or lower(coalesce(e.unit, '')) = lower(:unit)
                or lower(coalesce(e.referenceProductUnit, '')) = lower(:unit)
                or lower(coalesce(e.scoreUnit, '')) = lower(:unit))
              and (:minScore is null or e.impactScore >= :minScore)
              and (:maxScore is null or e.impactScore <= :maxScore)
            order by e.materialName asc
            """)
    List<EcoinventMaster> searchLocalDatasets(@Param("keyword") String keyword,
                                               @Param("geography") String geography,
                                               @Param("unit") String unit,
                                               @Param("minScore") Double minScore,
                                               @Param("maxScore") Double maxScore,
                                               Pageable pageable);

}

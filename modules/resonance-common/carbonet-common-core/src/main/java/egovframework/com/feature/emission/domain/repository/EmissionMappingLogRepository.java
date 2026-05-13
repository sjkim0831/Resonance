package egovframework.com.feature.emission.domain.repository;

import egovframework.com.feature.emission.domain.entity.EmissionMappingLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmissionMappingLogRepository extends JpaRepository<EmissionMappingLog, Long> {
    @Query("select coalesce(max(e.id), 0) from EmissionMappingLog e")
    long findMaxId();

    @Query("""
            select m
            from EmissionMappingLog m
            left join m.mappedMaterial e
            where lower(m.rawMaterialName) = lower(:rawMaterialName)
            order by
                coalesce(e.timePeriod, '') desc,
                case
                    when lower(coalesce(e.geography, '')) = 'kr' or lower(coalesce(e.geography, '')) like '%(kr)' then 0
                    when lower(coalesce(e.geography, '')) = 'row' or lower(coalesce(e.geography, '')) like '%(row)' or lower(coalesce(e.geography, '')) = 'rest-of-world (row)' then 1
                    when lower(coalesce(e.geography, '')) = 'rer' or lower(coalesce(e.geography, '')) like '%(rer)' then 2
                    when lower(coalesce(e.geography, '')) = 'glo' or lower(coalesce(e.geography, '')) like '%(glo)' or lower(coalesce(e.geography, '')) = 'global (glo)' then 3
                    when lower(coalesce(e.geography, '')) = 'eu' or lower(coalesce(e.geography, '')) like '%(eu)' then 4
                    when lower(coalesce(e.geography, '')) = 'jp' or lower(coalesce(e.geography, '')) like '%(jp)' then 5
                    when lower(coalesce(e.geography, '')) = 'ch' or lower(coalesce(e.geography, '')) like '%(ch)' then 6
                    when lower(coalesce(e.geography, '')) = 'in' or lower(coalesce(e.geography, '')) like '%(in)' then 7
                    else 8
                end asc,
                case
                    when lower(coalesce(e.activityType, '')) = 'market_activity' then 0
                    when lower(coalesce(e.activityName, '')) like 'market for %' then 1
                    else 2
                end asc,
                e.productName asc,
                e.activityName asc,
                e.id asc
            """)
    List<EmissionMappingLog> findPrioritizedByRawMaterialNameIgnoreCase(@Param("rawMaterialName") String rawMaterialName, Pageable pageable);

    @Query("""
            select m
            from EmissionMappingLog m
            left join m.mappedMaterial e
            where lower(m.rawMaterialName) like lower(concat('%', :rawMaterialName, '%'))
            order by
                case
                    when lower(m.rawMaterialName) = lower(:rawMaterialName) then 0
                    else 1
                end asc,
                coalesce(e.timePeriod, '') desc,
                case
                    when lower(coalesce(e.geography, '')) = 'kr' or lower(coalesce(e.geography, '')) like '%(kr)' then 0
                    when lower(coalesce(e.geography, '')) = 'row' or lower(coalesce(e.geography, '')) like '%(row)' or lower(coalesce(e.geography, '')) = 'rest-of-world (row)' then 1
                    when lower(coalesce(e.geography, '')) = 'rer' or lower(coalesce(e.geography, '')) like '%(rer)' then 2
                    when lower(coalesce(e.geography, '')) = 'glo' or lower(coalesce(e.geography, '')) like '%(glo)' or lower(coalesce(e.geography, '')) = 'global (glo)' then 3
                    when lower(coalesce(e.geography, '')) = 'eu' or lower(coalesce(e.geography, '')) like '%(eu)' then 4
                    when lower(coalesce(e.geography, '')) = 'jp' or lower(coalesce(e.geography, '')) like '%(jp)' then 5
                    when lower(coalesce(e.geography, '')) = 'ch' or lower(coalesce(e.geography, '')) like '%(ch)' then 6
                    when lower(coalesce(e.geography, '')) = 'in' or lower(coalesce(e.geography, '')) like '%(in)' then 7
                    else 8
                end asc,
                case
                    when lower(coalesce(e.activityType, '')) = 'market_activity' then 0
                    when lower(coalesce(e.activityName, '')) like 'market for %' then 1
                    else 2
                end asc,
                e.productName asc,
                e.activityName asc,
                e.id asc
            """)
    List<EmissionMappingLog> findPrioritizedContainingRawMaterialNameIgnoreCase(@Param("rawMaterialName") String rawMaterialName, Pageable pageable);

    boolean existsByRawMaterialNameIgnoreCaseAndMappedMaterial_Id(String rawMaterialName, Long mappedMaterialId);
}

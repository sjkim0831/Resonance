package egovframework.com.feature.auth.domain.repository;

import egovframework.com.feature.auth.domain.entity.PasswordResetHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PasswordResetHistoryRepository extends JpaRepository<PasswordResetHistory, String> {

    List<PasswordResetHistory> findTop10ByTargetUserIdOrderByResetPnttmDesc(String targetUserId);

    @Query("select h from PasswordResetHistory h "
            + "where (:resetSource = '' or upper(coalesce(h.resetSource, '')) = upper(:resetSource)) "
            + "and (:insttId = '' "
            + "or exists (select 1 from uiaEmplyrInfo e where e.emplyrId = h.targetUserId and coalesce(e.insttId, '') = :insttId) "
            + "or exists (select 1 from uiaEntrprsMber m where m.entrprsMberId = h.targetUserId and coalesce(m.insttId, '') = :insttId) "
            + "or exists (select 1 from uiaGnrlMber g where g.mberId = h.targetUserId and coalesce(g.groupId, '') = :insttId)) "
            + "and (:keyword = '' "
            + "or lower(coalesce(h.targetUserId, '')) like lower(concat('%', :keyword, '%')) "
            + "or lower(coalesce(h.resetByUserId, '')) like lower(concat('%', :keyword, '%')) "
            + "or lower(coalesce(h.resetIp, '')) like lower(concat('%', :keyword, '%')) "
            + "or lower(coalesce(h.resetSource, '')) like lower(concat('%', :keyword, '%')) "
            + "or lower(coalesce(h.targetUserSe, '')) like lower(concat('%', :keyword, '%')))")
    Page<PasswordResetHistory> searchPasswordResetHistories(
            @Param("resetSource") String resetSource,
            @Param("insttId") String insttId,
            @Param("keyword") String keyword,
            Pageable pageable);
}

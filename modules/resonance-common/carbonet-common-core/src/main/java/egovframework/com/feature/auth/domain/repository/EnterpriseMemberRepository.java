package egovframework.com.feature.auth.domain.repository;

import egovframework.com.feature.auth.domain.entity.EntrprsMber;
import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository("uiaEnterpriseMemberRepository")
public interface EnterpriseMemberRepository extends JpaRepository<EntrprsMber, String> {

    @Query("SELECT new egovframework.com.feature.auth.dto.response.LoginResponseDTO( " +
            "a.entrprsMberId, " +
            "a.cmpnyNm, " +
            "a.entrprsMberPassword, " +
            "a.bizrno, " +
            "a.applcntEmailAdres, " +
            "'ENT', " +
            "'', " +
            "a.esntlId, " +
            "'', " +
            "b.authorCode " +
            ") " +
            "FROM uiaEntrprsMber a " +
            "INNER JOIN uiaEmplyrscrtyestbs b " +
            "ON a.esntlId = b.scrtyDtrmnTrgetId " +
            "WHERE a.entrprsMberId = :userId " +
            "AND a.entrprsMberPassword = :password " +
            "AND a.entrprsMberStus IN ('A','P','R') "
    )
    LoginResponseDTO findByIdAndPassword(String userId, String password);

    Optional<EntrprsMber> findByEntrprsMberIdAndProjectId(String entrprsMberId, String projectId);

    Optional<EntrprsMber> findFirstByAuthCi(String authCi);

    Optional<EntrprsMber> findFirstByAuthDi(String authDi);
}

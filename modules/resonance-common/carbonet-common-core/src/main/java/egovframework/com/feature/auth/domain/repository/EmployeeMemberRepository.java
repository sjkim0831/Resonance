package egovframework.com.feature.auth.domain.repository;

import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository("uiaEmployeeMemberRepository")
public interface EmployeeMemberRepository extends JpaRepository<EmplyrInfo, String> {

    @Query("SELECT new egovframework.com.feature.auth.dto.response.LoginResponseDTO( " +
            "a.emplyrId, " +
            "a.userNm, " +
            "a.password, " +
            "a.ihidNum, " +
            "a.emailAdres, " +
            "'USR', " +
            "a.orgnztId, " +
            "a.esntlId, " +
            "'', " +
            "b.authorCode " +
            ") " +
            "FROM uiaEmplyrInfo a " +
            "INNER JOIN uiaEmplyrscrtyestbs b " +
            "ON a.esntlId = b.scrtyDtrmnTrgetId " +
            "WHERE a.emplyrId = :userId " +
            "AND a.password = :password " +
            "AND a.emplyrStusCode = 'P' "
    )
    LoginResponseDTO findByIdAndPassword(String userId, String password);

    @Query("SELECT a FROM uiaEmplyrInfo a " +
            "WHERE (:keyword IS NULL OR :keyword = '' " +
            "OR a.emplyrId LIKE %:keyword% " +
            "OR a.userNm LIKE %:keyword% " +
            "OR a.orgnztId LIKE %:keyword% " +
            "OR a.emailAdres LIKE %:keyword%) " +
            "AND (:status IS NULL OR :status = '' OR a.emplyrStusCode = :status)"
    )
    Page<EmplyrInfo> searchAdminMembers(
            @Param("keyword") String keyword,
            @Param("status") String status,
            Pageable pageable);

    @Query("SELECT a FROM uiaEmplyrInfo a " +
            "WHERE (:keyword IS NULL OR :keyword = '' " +
            "OR a.emplyrId LIKE %:keyword% " +
            "OR a.userNm LIKE %:keyword% " +
            "OR a.orgnztId LIKE %:keyword% " +
            "OR a.emailAdres LIKE %:keyword%) " +
            "AND (:status IS NULL OR :status = '' OR a.emplyrStusCode = :status) " +
            "AND (:insttId IS NULL OR :insttId = '' OR a.insttId = :insttId)"
    )
    List<EmplyrInfo> searchAdminMembersForManagement(
            @Param("keyword") String keyword,
            @Param("status") String status,
            @Param("insttId") String insttId,
            Sort sort);

    Optional<EmplyrInfo> findFirstByAuthCi(String authCi);

    Optional<EmplyrInfo> findFirstByAuthDi(String authDi);

}

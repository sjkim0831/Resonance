package egovframework.com.feature.auth.domain.repository;

import egovframework.com.feature.auth.domain.entity.GnrlMber;
import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository("uiaGeneralMemberRepository")
public interface GeneralMemberRepository extends JpaRepository<GnrlMber, String> {

    @Query("SELECT new egovframework.com.feature.auth.dto.response.LoginResponseDTO( " +
            "a.mberId, " +
            "a.mberNm, " +
            "a.password, " +
            "a.ihidNum, " +
            "a.mberEmailAdres, " +
            "'GNR', " +
            "'', " +
            "a.esntlId, " +
            "'', " +
            "b.authorCode " +
            ") " +
            "FROM uiaGnrlMber a " +
            "INNER JOIN uiaEmplyrscrtyestbs b " +
            "ON a.esntlId = b.scrtyDtrmnTrgetId " +
            "WHERE a.mberId = :userId " +
            "AND a.password = :password " +
            "AND a.mberStus = 'P' "
    )
    LoginResponseDTO findByIdAndPassword(String userId, String password);

    Optional<GnrlMber> findFirstByAuthCi(String authCi);

    Optional<GnrlMber> findFirstByAuthDi(String authDi);
}

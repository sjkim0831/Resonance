package egovframework.com.feature.auth.domain.repository;

import egovframework.com.feature.auth.domain.entity.LoginPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository("uiaLoginPolicyRepository")
public interface LoginPolicyRepository extends JpaRepository<LoginPolicy, String> {
}

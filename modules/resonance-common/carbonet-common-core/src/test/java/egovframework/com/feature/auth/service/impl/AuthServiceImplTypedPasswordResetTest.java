package egovframework.com.feature.auth.service.impl;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.entity.EntrprsMber;
import egovframework.com.feature.auth.domain.entity.GnrlMber;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.domain.repository.EnterpriseMemberRepository;
import egovframework.com.feature.auth.domain.repository.GeneralMemberRepository;
import egovframework.com.feature.auth.domain.repository.LoginPolicyRepository;
import egovframework.com.feature.auth.domain.repository.PasswordResetHistoryRepository;
import egovframework.com.feature.auth.mapper.AuthLoginMapper;
import egovframework.com.feature.auth.service.CredentialMutationLockService;
import egovframework.com.feature.auth.service.CredentialRevocationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceImplTypedPasswordResetTest {

    private GeneralMemberRepository generalMembers;
    private EnterpriseMemberRepository enterpriseMembers;
    private EmployeeMemberRepository employees;
    private CredentialMutationLockService credentialLock;
    private CredentialRevocationService credentialRevocation;
    private AuthServiceImpl service;

    @BeforeEach
    void setUp() {
        generalMembers = mock(GeneralMemberRepository.class);
        enterpriseMembers = mock(EnterpriseMemberRepository.class);
        employees = mock(EmployeeMemberRepository.class);
        credentialLock = mock(CredentialMutationLockService.class);
        credentialRevocation = mock(CredentialRevocationService.class);
        ProjectRuntimeContext project = mock(ProjectRuntimeContext.class);
        when(project.getProjectId()).thenReturn("");
        service = new AuthServiceImpl(
                generalMembers,
                enterpriseMembers,
                employees,
                mock(LoginPolicyRepository.class),
                mock(PasswordResetHistoryRepository.class),
                mock(AuthLoginMapper.class),
                project,
                credentialLock,
                credentialRevocation);
    }

    @Test
    void sameIdAcrossTypesUpdatesOnlyThePersistedUsrTarget() {
        EntrprsMber enterprise = enterprise("same-id", "A");
        EmplyrInfo employee = employee("same-id", "P");
        when(enterpriseMembers.findById("same-id")).thenReturn(Optional.of(enterprise));
        when(employees.findById("same-id")).thenReturn(Optional.of(employee));

        assertTrue(service.resetPassword(
                "same-id", "USR", "NewPass1!", "same-id", "127.0.0.1", "ACCOUNT_RECOVERY"));

        verify(employees).save(employee);
        verify(credentialLock).acquireInCurrentTransaction("same-id");
        verify(credentialRevocation).revokeAfterPasswordChange("same-id");
        verify(enterpriseMembers, never()).save(any());
        verify(enterpriseMembers, never()).findById("same-id");
    }

    @Test
    void inactiveBoundTypeFailsClosedWithoutTryingAnotherType() {
        GnrlMber inactiveGeneral = general("same-id", "D");
        EntrprsMber activeEnterprise = enterprise("same-id", "A");
        when(generalMembers.findById("same-id")).thenReturn(Optional.of(inactiveGeneral));
        when(enterpriseMembers.findById("same-id")).thenReturn(Optional.of(activeEnterprise));

        assertFalse(service.resetPassword(
                "same-id", "GNR", "NewPass1!", "same-id", "127.0.0.1", "ACCOUNT_RECOVERY"));

        verify(generalMembers, never()).save(any());
        verify(credentialLock).acquireInCurrentTransaction("same-id");
        verify(credentialRevocation, never()).revokeAfterPasswordChange(any());
        verify(enterpriseMembers, never()).findById("same-id");
        verify(enterpriseMembers, never()).save(any());
    }

    @Test
    void missingBoundTypeFailsClosedWithoutTryingAnotherType() {
        when(employees.findById("same-id")).thenReturn(Optional.empty());
        when(generalMembers.findById("same-id")).thenReturn(Optional.of(general("same-id", "P")));

        assertFalse(service.resetPassword(
                "same-id", "USR", "NewPass1!", "same-id", "127.0.0.1", "ACCOUNT_RECOVERY"));

        verify(generalMembers, never()).findById("same-id");
        verify(employees, never()).save(any());
        verify(credentialLock).acquireInCurrentTransaction("same-id");
        verify(credentialRevocation, never()).revokeAfterPasswordChange(any());
    }

    @Test
    void unsupportedTypeFailsBeforeAnyRepositoryLookup() {
        assertFalse(service.resetPassword(
                "same-id", "UNKNOWN", "NewPass1!", "same-id", "127.0.0.1", "ACCOUNT_RECOVERY"));

        verify(generalMembers, never()).findById("same-id");
        verify(enterpriseMembers, never()).findById("same-id");
        verify(employees, never()).findById("same-id");
        verify(credentialLock, never()).acquireInCurrentTransaction(any());
        verify(credentialRevocation, never()).revokeAfterPasswordChange(any());
    }

    private EntrprsMber enterprise(String userId, String status) {
        EntrprsMber member = new EntrprsMber();
        member.setEntrprsMberId(userId);
        member.setEntrprsMberStus(status);
        member.setEntrprsMberPassword("old-enterprise");
        return member;
    }

    private GnrlMber general(String userId, String status) {
        GnrlMber member = new GnrlMber();
        member.setMberId(userId);
        member.setMberStus(status);
        member.setPassword("old-general");
        return member;
    }

    private EmplyrInfo employee(String userId, String status) {
        EmplyrInfo member = new EmplyrInfo();
        member.setEmplyrId(userId);
        member.setEmplyrStusCode(status);
        member.setPassword("old-employee");
        return member;
    }
}

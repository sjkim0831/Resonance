package egovframework.com.feature.auth.service;

import egovframework.com.feature.auth.mapper.AuthLoginMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.lang.reflect.Method;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CredentialMutationLockServiceTest {

    private AuthLoginMapper mapper;
    private CredentialMutationLockService service;

    @BeforeEach
    void setUp() {
        mapper = mock(AuthLoginMapper.class);
        service = new CredentialMutationLockService(mapper);
    }

    @AfterEach
    void clearTransactionMarker() {
        TransactionSynchronizationManager.setActualTransactionActive(false);
    }

    @Test
    void wrapperDeclaresRequiredTransactionAndLockMethodDeclaresMandatoryTransaction() throws Exception {
        Method wrapper = CredentialMutationLockService.class.getMethod("executeLocked", String.class,
                java.util.function.Supplier.class);
        Method lock = CredentialMutationLockService.class.getMethod("acquireInCurrentTransaction", String.class);

        assertTrue(wrapper.isAnnotationPresent(Transactional.class));
        assertEquals(Propagation.REQUIRED, wrapper.getAnnotation(Transactional.class).propagation());
        assertEquals(Propagation.MANDATORY, lock.getAnnotation(Transactional.class).propagation());
    }

    @Test
    void lockIsAcquiredBeforeCredentialActionAndUserIdIsCanonicalized() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        when(mapper.acquireCredentialMutationLock("member01")).thenReturn(1);
        AtomicBoolean executed = new AtomicBoolean();

        String result = service.executeLocked("  MEMBER01  ", () -> {
            executed.set(true);
            return "done";
        });

        assertEquals("done", result);
        assertTrue(executed.get());
        var ordered = inOrder(mapper);
        ordered.verify(mapper).acquireCredentialMutationLock("member01");
    }

    @Test
    void missingTransactionFailsBeforeDatabaseOrCredentialAction() {
        AtomicBoolean executed = new AtomicBoolean();

        assertThrows(IllegalStateException.class,
                () -> service.executeLocked("member01", () -> executed.set(true)));

        assertTrue(!executed.get());
        verify(mapper, never()).acquireCredentialMutationLock("member01");
    }

    @Test
    void databaseLockFailureFailsClosedBeforeCredentialAction() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        when(mapper.acquireCredentialMutationLock("member01")).thenReturn(0);
        AtomicBoolean executed = new AtomicBoolean();

        assertThrows(IllegalStateException.class,
                () -> service.executeLocked("member01", () -> executed.set(true)));

        assertTrue(!executed.get());
    }
}

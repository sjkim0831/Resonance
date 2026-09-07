package egovframework.com.platform.governance.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CompositeDesignOperationalWorkerCapacityTest {
    @Test
    void oneHundredEightProcessesAtP95OneHundredNinetySecondsFailEightSlots(){
        assertEquals(2565L,CompositeDesignOperationalWorker.estimateSeconds(108,190_000L,8));
        assertEquals(35L,CompositeDesignOperationalWorker.requiredParallelismFor(108,190_000L));
    }
}

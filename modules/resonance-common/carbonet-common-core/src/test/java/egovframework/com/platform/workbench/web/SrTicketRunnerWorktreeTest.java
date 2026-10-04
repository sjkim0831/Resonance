package egovframework.com.platform.workbench.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.codex.service.impl.SrTicketCodexRunnerServiceImpl;
import egovframework.com.platform.codex.model.SrTicketRunnerExecutionVO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;
import java.nio.file.*;
import static org.junit.jupiter.api.Assertions.*;

class SrTicketRunnerWorktreeTest {
    @TempDir Path root;
    SrTicketCodexRunnerServiceImpl runner = new SrTicketCodexRunnerServiceImpl(new ObjectMapper());
    void git(String... args) throws Exception {
        var command = new java.util.ArrayList<String>(); command.add("git");command.addAll(java.util.List.of(args));
        var p=new ProcessBuilder(command).directory(root.toFile()).redirectErrorStream(true).start();
        String out=new String(p.getInputStream().readAllBytes());assertEquals(0,p.waitFor(),out);
    }
    @Test void frontendVerificationUsesChangedWorktree() throws Exception {
        Files.createDirectories(root.resolve("ui"));
        ReflectionTestUtils.setField(runner,"repositoryRoot","/not-the-worktree");
        ReflectionTestUtils.setField(runner,"frontendVerifyWorkdir","ui");
        assertEquals(root.resolve("ui").toRealPath(),ReflectionTestUtils.invokeMethod(runner,"resolveFrontendVerifyDirectory",root));
    }
    @Test void absoluteVerificationDirectoryRejected() {
        ReflectionTestUtils.setField(runner,"frontendVerifyWorkdir","/tmp");
        assertThrows(IllegalArgumentException.class,()->ReflectionTestUtils.invokeMethod(runner,"resolveFrontendVerifyDirectory",root));
    }
    @Test void traversalVerificationDirectoryRejected() {
        ReflectionTestUtils.setField(runner,"frontendVerifyWorkdir","..");
        assertThrows(IllegalArgumentException.class,()->ReflectionTestUtils.invokeMethod(runner,"resolveFrontendVerifyDirectory",root));
    }
    @Test void newAndStagedFilesIncludedAndAllowlistEnforced() throws Exception {
        git("init");git("config","user.name","Fixture");git("config","user.email","fixture@example.invalid");
        Files.writeString(root.resolve("existing.txt"),"before\n");git("add","existing.txt");git("commit","-m","fixture baseline");
        Files.writeString(root.resolve("existing.txt"),"after\n");git("add","existing.txt");
        Files.writeString(root.resolve("new.txt"),"new code\n");
        ReflectionTestUtils.setField(runner,"commandTimeoutSeconds",10L);
        ReflectionTestUtils.setField(runner,"allowedPathPrefixes","existing.txt");
        var execution=new SrTicketRunnerExecutionVO();
        Path artifacts=Files.createTempDirectory("runner-evidence-");
        try {
            ReflectionTestUtils.invokeMethod(runner,"collectGitArtifacts",root,artifacts.resolve("diff"),artifacts.resolve("files"),execution);
            assertTrue(execution.getChangedFiles().contains("existing.txt"));
            assertTrue(execution.getChangedFiles().contains("new.txt"));
            assertFalse(execution.isChangedFilesAllowed());
            String diff=Files.readString(artifacts.resolve("diff"));assertTrue(diff.contains("+after"));assertTrue(diff.contains("+new code"));
        } finally {Files.deleteIfExists(artifacts.resolve("diff"));Files.deleteIfExists(artifacts.resolve("files"));Files.deleteIfExists(artifacts);}
    }
}

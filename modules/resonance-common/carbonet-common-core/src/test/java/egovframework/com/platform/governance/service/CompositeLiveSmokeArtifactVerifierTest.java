package egovframework.com.platform.governance.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.LinkOption;
import java.nio.file.attribute.PosixFileAttributeView;
import java.nio.file.attribute.PosixFilePermission;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CompositeLiveSmokeArtifactVerifierTest {
    private static final String RUN_ID="11111111-1111-4111-8111-111111111111";

    @Test
    void rehashesControlledArtifactBytesAndRejectsSubmittedHashMutation(@TempDir Path root)throws Exception{
        byte[] bytes="<html><main data-last-command-code=\"SAVE\"></main></html>"
            .getBytes(StandardCharsets.UTF_8);
        String hash=sha256(bytes),reference=reference(hash,"dom.html");
        write(root,reference,bytes);
        var observed=CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference,hash,
            "dom.html",4096);
        assertEquals(hash,observed.hash());assertEquals(bytes.length,observed.byteCount());
        assertEquals("LIVE_SMOKE_ARTIFACT_HASH_MISMATCH",assertThrows(IllegalArgumentException.class,()->
            CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference,"f".repeat(64),
                "dom.html",4096)).getMessage());
        if(Files.getFileAttributeView(root.resolve(reference),PosixFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS)!=null){
            Files.setPosixFilePermissions(root.resolve(reference),Set.of(PosixFilePermission.OWNER_READ,
                PosixFilePermission.OWNER_WRITE));
            assertEquals("LIVE_SMOKE_ARTIFACT_WRITABLE_FORBIDDEN",assertThrows(
                IllegalArgumentException.class,()->CompositeLiveSmokeEvidenceService.verifyArtifact(
                    root,reference,hash,"dom.html",4096)).getMessage());
        }
        Files.writeString(root.resolve(reference),"tampered",StandardCharsets.UTF_8);
        if(Files.getFileAttributeView(root.resolve(reference),PosixFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS)!=null)
            Files.setPosixFilePermissions(root.resolve(reference),Set.of(PosixFilePermission.OWNER_READ,
                PosixFilePermission.GROUP_READ));
        assertEquals("LIVE_SMOKE_ARTIFACT_HASH_MISMATCH",assertThrows(IllegalArgumentException.class,()->
            CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference,hash,"dom.html",4096)).getMessage());
    }

    @Test
    void rejectsTraversalMissingAndWrongArtifactKind(@TempDir Path root)throws Exception{
        String hash="a".repeat(64);
        assertEquals("LIVE_SMOKE_ARTIFACT_REFERENCE_INVALID",assertThrows(IllegalArgumentException.class,()->
            CompositeLiveSmokeEvidenceService.verifyArtifact(root,"91/"+RUN_ID+"/../../secret",hash,
                "dom.html",4096)).getMessage());
        assertEquals("LIVE_SMOKE_ARTIFACT_MISSING",assertThrows(IllegalArgumentException.class,()->
            CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference(hash,"dom.html"),hash,
                "dom.html",4096)).getMessage());
        byte[] png="PNG_BYTES".getBytes(StandardCharsets.UTF_8);String pngHash=sha256(png);
        write(root,reference(pngHash,"screenshot.png"),png);
        assertEquals("LIVE_SMOKE_ARTIFACT_REFERENCE_INVALID",assertThrows(IllegalArgumentException.class,()->
            CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference(pngHash,"screenshot.png"),
                pngHash,"dom.html",4096)).getMessage());
    }

    @Test
    void rejectsSymlinkAtAnyArtifactPathComponent(@TempDir Path root)throws Exception{
        Path outside=Files.createTempDirectory("live-smoke-artifact-outside-");
        Path link=root.resolve("91").resolve(RUN_ID);
        try{
            byte[] bytes="outside".getBytes(StandardCharsets.UTF_8);String hash=sha256(bytes);
            Path outsideRun=Files.createDirectories(outside.resolve(RUN_ID));
            Files.write(outsideRun.resolve(hash+".dom.html"),bytes);
            Path dispatch=Files.createDirectories(root.resolve("91"));
            link=dispatch.resolve(RUN_ID);
            try{Files.createSymbolicLink(link,outsideRun);}
            catch(java.nio.file.FileSystemException denied){
                if(!System.getProperty("os.name","").toLowerCase().contains("windows"))throw denied;
                Process junction=new ProcessBuilder("cmd.exe","/d","/c","mklink","/J",
                    link.toString(),outsideRun.toString()).redirectErrorStream(true).start();
                if(junction.waitFor()!=0)throw denied;
            }
            assertEquals("LIVE_SMOKE_ARTIFACT_SYMLINK_FORBIDDEN",assertThrows(IllegalArgumentException.class,()->
                CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference(hash,"dom.html"),hash,
                    "dom.html",4096)).getMessage());
        }finally{
            Files.deleteIfExists(link);
            if(Files.exists(outside))try(var paths=Files.walk(outside)){
                paths.sorted((left,right)->right.getNameCount()-left.getNameCount()).forEach(path->{
                    try{Files.deleteIfExists(path);}catch(Exception ignored){}
                });
            }
        }
    }

    private static String reference(String hash,String suffix){return "91/"+RUN_ID+"/"+hash+"."+suffix;}
    private static void write(Path root,String reference,byte[] bytes)throws Exception{
        Path target=root.resolve(reference);Files.createDirectories(target.getParent());Files.write(target,bytes);
        if(Files.getFileAttributeView(target,PosixFileAttributeView.class,LinkOption.NOFOLLOW_LINKS)!=null)
            Files.setPosixFilePermissions(target,Set.of(PosixFilePermission.OWNER_READ,
                PosixFilePermission.GROUP_READ));
    }
    private static String sha256(byte[] bytes)throws Exception{return HexFormat.of().formatHex(
        MessageDigest.getInstance("SHA-256").digest(bytes));}
}

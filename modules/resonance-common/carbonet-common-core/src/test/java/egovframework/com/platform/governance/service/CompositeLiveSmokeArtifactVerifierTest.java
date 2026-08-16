package egovframework.com.platform.governance.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFileAttributeView;
import java.nio.file.attribute.PosixFilePermission;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;

import javax.imageio.ImageIO;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CompositeLiveSmokeArtifactVerifierTest {
    private static final String RUN_ID="11111111-1111-4111-8111-111111111111";

    @Test
    void rehashesControlledArtifactBytesAndRejectsSubmittedHashMutation(@TempDir Path root)throws Exception{
        byte[] bytes="<html><main data-last-command-code=\"SAVE\"></main></html>"
            .getBytes(StandardCharsets.UTF_8);
        String hash=sha256(bytes),reference=reference(hash,"dom.html");
        write(root,reference,bytes);
        var observed=CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference,hash,
            "dom.html",4096,91,RUN_ID);
        assertEquals(hash,observed.hash());assertEquals(bytes.length,observed.byteCount());
        assertEquals("LIVE_SMOKE_ARTIFACT_HASH_MISMATCH",assertThrows(IllegalArgumentException.class,()->
            CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference,"f".repeat(64),
                "dom.html",4096,91,RUN_ID)).getMessage());
        if(Files.getFileAttributeView(root.resolve(reference),PosixFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS)!=null){
            Files.setPosixFilePermissions(root.resolve(reference),Set.of(PosixFilePermission.OWNER_READ,
                PosixFilePermission.OWNER_WRITE));
            assertEquals("LIVE_SMOKE_ARTIFACT_WRITABLE_FORBIDDEN",assertThrows(
                IllegalArgumentException.class,()->CompositeLiveSmokeEvidenceService.verifyArtifact(
                    root,reference,hash,"dom.html",4096,91,RUN_ID)).getMessage());
        }
        Files.writeString(root.resolve(reference),"tampered",StandardCharsets.UTF_8);
        if(Files.getFileAttributeView(root.resolve(reference),PosixFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS)!=null)
            Files.setPosixFilePermissions(root.resolve(reference),Set.of(PosixFilePermission.OWNER_READ,
                PosixFilePermission.GROUP_READ));
        assertEquals("LIVE_SMOKE_ARTIFACT_HASH_MISMATCH",assertThrows(IllegalArgumentException.class,()->
            CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference,hash,
                "dom.html",4096,91,RUN_ID)).getMessage());
    }

    @Test
    void rejectsTraversalMissingAndWrongArtifactKind(@TempDir Path root)throws Exception{
        String hash="a".repeat(64);
        assertEquals("LIVE_SMOKE_ARTIFACT_REFERENCE_INVALID",assertThrows(IllegalArgumentException.class,()->
            CompositeLiveSmokeEvidenceService.verifyArtifact(root,"91/"+RUN_ID+"/../../secret",hash,
                "dom.html",4096,91,RUN_ID)).getMessage());
        assertEquals("LIVE_SMOKE_ARTIFACT_MISSING",assertThrows(IllegalArgumentException.class,()->
            CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference(hash,"dom.html"),hash,
                "dom.html",4096,91,RUN_ID)).getMessage());
        byte[] png="PNG_BYTES".getBytes(StandardCharsets.UTF_8);String pngHash=sha256(png);
        write(root,reference(pngHash,"screenshot.png"),png);
        assertEquals("LIVE_SMOKE_ARTIFACT_REFERENCE_INVALID",assertThrows(IllegalArgumentException.class,()->
            CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference(pngHash,"screenshot.png"),
                pngHash,"dom.html",4096,91,RUN_ID)).getMessage());
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
                    "dom.html",4096,91,RUN_ID)).getMessage());
        }finally{
            Files.deleteIfExists(link);
            if(Files.exists(outside))try(var paths=Files.walk(outside)){
                paths.sorted((left,right)->right.getNameCount()-left.getNameCount()).forEach(path->{
                    try{Files.deleteIfExists(path);}catch(Exception ignored){}
                });
            }
        }
    }

    @Test
    void bindsArtifactReferenceToExactDispatchAndRun(@TempDir Path root)throws Exception{
        assertEquals("bddc44a4-ba5a-442e-9d02-2f503ab6ac2e",
            CompositeLiveSmokeEvidenceService.deterministicRunId(
                91,7,3,"SAVE","SCN_SAVE_SUCCESS","SUCCESS"));
        byte[] bytes="<html><main></main></html>".getBytes(StandardCharsets.UTF_8);
        String hash=sha256(bytes),reference=reference(hash,"dom.html");write(root,reference,bytes);
        assertEquals("LIVE_SMOKE_ARTIFACT_REFERENCE_INVALID",assertThrows(IllegalArgumentException.class,()->
            CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference,hash,"dom.html",4096,
                92,RUN_ID)).getMessage());
        assertEquals("LIVE_SMOKE_ARTIFACT_REFERENCE_INVALID",assertThrows(IllegalArgumentException.class,()->
            CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference,hash,"dom.html",4096,
                91,"22222222-2222-4222-8222-222222222222")).getMessage());
    }

    @Test
    void parsesExactBrowserDomMarkersAndRejectsSyntheticDom(){
        Map<String,Object> output=Map.of("success",true,"resultId",17);
        String idempotency="11111111-2222-4333-8444-555555555555";
        byte[] valid=dom("SAVE","SUCCESS",200,output,idempotency,true,false)
            .getBytes(StandardCharsets.UTF_8);
        CompositeLiveSmokeEvidenceService.verifyDomArtifact(artifact(valid,"dom.html"),
            "SAVE","SUCCESS",output,idempotency,200);

        byte[] forged=dom("DELETE","SUCCESS",200,output,idempotency,true,false)
            .getBytes(StandardCharsets.UTF_8);
        assertEquals("LIVE_SMOKE_DOM_MARKER_CARDINALITY_NOT_EXACT",assertThrows(
            IllegalArgumentException.class,()->CompositeLiveSmokeEvidenceService.verifyDomArtifact(
                artifact(forged,"dom.html"),"SAVE","SUCCESS",output,idempotency,200)).getMessage());

        byte[] synthetic="<html><body><main data-last-command-code=\"SAVE\"></main></body></html>"
            .getBytes(StandardCharsets.UTF_8);
        assertEquals("LIVE_SMOKE_DOM_MARKER_CARDINALITY_NOT_EXACT",assertThrows(
            IllegalArgumentException.class,()->CompositeLiveSmokeEvidenceService.verifyDomArtifact(
                artifact(synthetic,"dom.html"),"SAVE","SUCCESS",output,idempotency,200)).getMessage());
    }

    @Test
    void decodesRealNontrivialPngAndRejectsFakeOrBlankPng()throws Exception{
        byte[] png=png(false);
        CompositeLiveSmokeEvidenceService.verifyPngArtifact(artifact(png,"screenshot.png"));

        byte[] fake="PNG_BYTES".getBytes(StandardCharsets.UTF_8);
        assertEquals("LIVE_SMOKE_SCREENSHOT_PNG_SIGNATURE_INVALID",assertThrows(
            IllegalArgumentException.class,()->CompositeLiveSmokeEvidenceService.verifyPngArtifact(
                artifact(fake,"screenshot.png"))).getMessage());

        byte[] blank=png(true);
        assertEquals("LIVE_SMOKE_SCREENSHOT_CONTENT_TRIVIAL",assertThrows(
            IllegalArgumentException.class,()->CompositeLiveSmokeEvidenceService.verifyPngArtifact(
                artifact(blank,"screenshot.png"))).getMessage());
    }

    @Test
    void rejectsArtifactMutatedAfterPinnedOpen(@TempDir Path root)throws Exception{
        byte[] original="A".repeat(8192).getBytes(StandardCharsets.UTF_8);
        String hash=sha256(original),reference=reference(hash,"dom.html");write(root,reference,original);
        Path target=root.resolve(reference);
        IllegalArgumentException error=assertThrows(IllegalArgumentException.class,()->
            CompositeLiveSmokeEvidenceService.verifyArtifact(root,reference,hash,"dom.html",16384,
                91,RUN_ID,()->{
                    if(Files.getFileAttributeView(target,PosixFileAttributeView.class,
                            LinkOption.NOFOLLOW_LINKS)!=null)
                        Files.setPosixFilePermissions(target,Set.of(PosixFilePermission.OWNER_READ,
                            PosixFilePermission.OWNER_WRITE));
                    Files.write(target,"B".repeat(8192).getBytes(StandardCharsets.UTF_8),
                        StandardOpenOption.TRUNCATE_EXISTING);
                }));
        assertTrue(Set.of("LIVE_SMOKE_ARTIFACT_CHANGED_DURING_READ",
            "LIVE_SMOKE_ARTIFACT_HASH_MISMATCH","LIVE_SMOKE_ARTIFACT_READ_FAILED")
            .contains(error.getMessage()),error.getMessage());
    }

    private static CompositeLiveSmokeEvidenceService.ArtifactObservation artifact(byte[] bytes,
            String suffix){
        String hash=uncheckedHash(bytes);
        return new CompositeLiveSmokeEvidenceService.ArtifactObservation(
            "91/"+RUN_ID+"/"+hash+"."+suffix,hash,bytes.length,bytes);
    }
    private static String reference(String hash,String suffix){return "91/"+RUN_ID+"/"+hash+"."+suffix;}
    private static String dom(String command,String status,int http,Map<String,Object> output,
            String idempotency,boolean runtime,boolean denied){
        String json=("{\"resultId\":"+output.get("resultId")+",\"success\":"+output.get("success")+"}")
            .replace("&","&amp;").replace("\"","&quot;");
        return "<html><body><main data-last-command-code=\""+command+"\" data-last-http-status=\""+
            http+"\" data-last-status-case=\""+status+"\" data-last-output-json=\""+json+
            "\" data-last-idempotency-key=\""+idempotency+"\" data-runtime-observed=\""+runtime+
            "\" data-access-denied=\""+denied+"\"></main><button data-command-code=\""+command+
            "\">run</button><section data-live-smoke-result=\"true\">result</section></body></html>";
    }
    private static byte[] png(boolean blank)throws Exception{
        BufferedImage image=new BufferedImage(128,96,BufferedImage.TYPE_INT_ARGB);
        for(int y=0;y<image.getHeight();y++)for(int x=0;x<image.getWidth();x++)
            image.setRGB(x,y,blank?0xfff8fafc:(x<64?0xff052b57:0xff246beb));
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        assertTrue(ImageIO.write(image,"png",bytes));return bytes.toByteArray();
    }
    private static void write(Path root,String reference,byte[] bytes)throws Exception{
        Path target=root.resolve(reference);Files.createDirectories(target.getParent());Files.write(target,bytes);
        if(Files.getFileAttributeView(target,PosixFileAttributeView.class,LinkOption.NOFOLLOW_LINKS)!=null)
            Files.setPosixFilePermissions(target,Set.of(PosixFilePermission.OWNER_READ,
                PosixFilePermission.GROUP_READ));
    }
    private static String sha256(byte[] bytes)throws Exception{return HexFormat.of().formatHex(
        MessageDigest.getInstance("SHA-256").digest(bytes));}
    private static String uncheckedHash(byte[] bytes){try{return sha256(bytes);}
        catch(Exception error){throw new IllegalStateException(error);}}
}

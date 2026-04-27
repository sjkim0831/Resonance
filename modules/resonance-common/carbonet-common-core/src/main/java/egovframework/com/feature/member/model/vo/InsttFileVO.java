package egovframework.com.feature.member.model.vo;

import java.io.Serializable;

public class InsttFileVO implements Serializable {

    private static final long serialVersionUID = 1L;

    private String fileId;
    private String insttId;
    private Integer fileSn;
    private String streFileNm;
    private String orignlFileNm;
    private String fileStrePath;
    private Long fileMg;
    private String fileExtsn;
    private String fileCn;
    private String regDate;

    public String getFileId() {
        return fileId;
    }

    public void setFileId(String fileId) {
        this.fileId = fileId;
    }

    public String getInsttId() {
        return insttId;
    }

    public void setInsttId(String insttId) {
        this.insttId = insttId;
    }

    public Integer getFileSn() {
        return fileSn;
    }

    public void setFileSn(Integer fileSn) {
        this.fileSn = fileSn;
    }

    public String getStreFileNm() {
        return streFileNm;
    }

    public void setStreFileNm(String streFileNm) {
        this.streFileNm = streFileNm;
    }

    public String getOrignlFileNm() {
        return orignlFileNm;
    }

    public void setOrignlFileNm(String orignlFileNm) {
        this.orignlFileNm = orignlFileNm;
    }

    public String getFileStrePath() {
        return fileStrePath;
    }

    public void setFileStrePath(String fileStrePath) {
        this.fileStrePath = fileStrePath;
    }

    public Long getFileMg() {
        return fileMg;
    }

    public void setFileMg(Long fileMg) {
        this.fileMg = fileMg;
    }

    public String getFileExtsn() {
        return fileExtsn;
    }

    public void setFileExtsn(String fileExtsn) {
        this.fileExtsn = fileExtsn;
    }

    public String getFileCn() {
        return fileCn;
    }

    public void setFileCn(String fileCn) {
        this.fileCn = fileCn;
    }

    public String getRegDate() {
        return regDate;
    }

    public void setRegDate(String regDate) {
        this.regDate = regDate;
    }
}

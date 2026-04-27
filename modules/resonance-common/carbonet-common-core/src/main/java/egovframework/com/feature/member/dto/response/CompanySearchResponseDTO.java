package egovframework.com.feature.member.dto.response;

import egovframework.com.feature.member.model.vo.CompanyListItemVO;
import lombok.Getter;

import java.util.List;

@Getter
public class CompanySearchResponseDTO {
    private List<CompanyListItemVO> list;
    private int totalCnt;
    private int page;
    private int size;
    private int totalPages;

    public CompanySearchResponseDTO(List<CompanyListItemVO> list, int totalCnt, int page, int size, int totalPages) {
        this.list = list;
        this.totalCnt = totalCnt;
        this.page = page;
        this.size = size;
        this.totalPages = totalPages;
    }
}

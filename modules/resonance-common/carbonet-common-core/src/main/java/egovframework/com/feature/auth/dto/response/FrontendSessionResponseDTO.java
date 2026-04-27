package egovframework.com.feature.auth.dto.response;

import java.util.ArrayList;
import java.util.List;

public class FrontendSessionResponseDTO {

    private boolean authenticated;
    private String actualUserId;
    private String userId;
    private String authorCode;
    private String insttId;
    private String companyScope;
    private boolean simulationAvailable;
    private boolean simulationActive;
    private boolean canEnterAdminConsole;
    private String csrfToken;
    private String csrfHeaderName;
    private List<String> featureCodes = new ArrayList<>();
    private List<String> capabilityCodes = new ArrayList<>();

    public boolean isAuthenticated() {
        return authenticated;
    }

    public void setAuthenticated(boolean authenticated) {
        this.authenticated = authenticated;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getActualUserId() {
        return actualUserId;
    }

    public void setActualUserId(String actualUserId) {
        this.actualUserId = actualUserId;
    }

    public String getAuthorCode() {
        return authorCode;
    }

    public void setAuthorCode(String authorCode) {
        this.authorCode = authorCode;
    }

    public String getInsttId() {
        return insttId;
    }

    public void setInsttId(String insttId) {
        this.insttId = insttId;
    }

    public String getCompanyScope() {
        return companyScope;
    }

    public void setCompanyScope(String companyScope) {
        this.companyScope = companyScope;
    }

    public boolean isSimulationAvailable() {
        return simulationAvailable;
    }

    public void setSimulationAvailable(boolean simulationAvailable) {
        this.simulationAvailable = simulationAvailable;
    }

    public boolean isSimulationActive() {
        return simulationActive;
    }

    public void setSimulationActive(boolean simulationActive) {
        this.simulationActive = simulationActive;
    }

    public boolean isCanEnterAdminConsole() {
        return canEnterAdminConsole;
    }

    public void setCanEnterAdminConsole(boolean canEnterAdminConsole) {
        this.canEnterAdminConsole = canEnterAdminConsole;
    }

    public String getCsrfToken() {
        return csrfToken;
    }

    public void setCsrfToken(String csrfToken) {
        this.csrfToken = csrfToken;
    }

    public String getCsrfHeaderName() {
        return csrfHeaderName;
    }

    public void setCsrfHeaderName(String csrfHeaderName) {
        this.csrfHeaderName = csrfHeaderName;
    }

    public List<String> getFeatureCodes() {
        return featureCodes;
    }

    public void setFeatureCodes(List<String> featureCodes) {
        this.featureCodes = featureCodes == null ? new ArrayList<>() : featureCodes;
    }

    public List<String> getCapabilityCodes() {
        return capabilityCodes;
    }

    public void setCapabilityCodes(List<String> capabilityCodes) {
        this.capabilityCodes = capabilityCodes == null ? new ArrayList<>() : capabilityCodes;
    }
}

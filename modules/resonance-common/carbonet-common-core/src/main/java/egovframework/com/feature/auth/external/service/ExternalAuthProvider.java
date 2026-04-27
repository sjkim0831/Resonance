package egovframework.com.feature.auth.external.service;

import egovframework.com.feature.auth.external.dto.request.ExternalAuthCompleteRequest;
import egovframework.com.feature.auth.external.dto.request.ExternalAuthStartRequest;
import egovframework.com.feature.auth.external.model.ExternalAuthIdentity;
import egovframework.com.feature.auth.external.model.ExternalAuthMethodDescriptor;
import egovframework.com.feature.auth.external.model.ExternalAuthSession;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

public interface ExternalAuthProvider {

    String getProviderCode();

    List<ExternalAuthMethodDescriptor> getMethodDescriptors(boolean english);

    boolean supports(String methodCode);

    ExternalAuthSession start(ExternalAuthStartRequest request, HttpServletRequest servletRequest);

    ExternalAuthIdentity complete(ExternalAuthSession session, ExternalAuthCompleteRequest request,
            HttpServletRequest servletRequest);
}

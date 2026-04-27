package egovframework.com.feature.auth.external.service;

import egovframework.com.feature.auth.external.dto.request.ExternalAuthCompleteRequest;
import egovframework.com.feature.auth.external.dto.request.ExternalAuthStartRequest;
import egovframework.com.feature.auth.external.model.ExternalAuthIdentity;
import egovframework.com.feature.auth.external.model.ExternalAuthSession;

import jakarta.servlet.http.HttpServletRequest;

public interface ExternalAuthAdapter {

    String getVersion();

    boolean isAvailable();

    ExternalAuthSession prepare(String providerCode, ExternalAuthStartRequest request, HttpServletRequest servletRequest);

    ExternalAuthIdentity resolve(String providerCode, ExternalAuthSession session,
            ExternalAuthCompleteRequest request, HttpServletRequest servletRequest);
}

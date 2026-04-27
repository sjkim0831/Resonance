package egovframework.com.feature.admin.framework.builder.support.impl;

import egovframework.com.feature.admin.framework.builder.support.CarbonetFrameworkApiResponseSource;
import egovframework.com.framework.web.FrameworkApiResponseSupport;
import org.slf4j.Logger;
import org.springframework.http.ResponseEntity;

public class CarbonetFrameworkApiResponseSourceAdapter implements CarbonetFrameworkApiResponseSource {

    @Override
    public ResponseEntity<?> execute(ApiAction action, String failureMessage, Logger log) {
        return FrameworkApiResponseSupport.execute(action::run, failureMessage, log);
    }
}

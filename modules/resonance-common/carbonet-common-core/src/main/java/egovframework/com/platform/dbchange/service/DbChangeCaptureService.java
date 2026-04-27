package egovframework.com.platform.dbchange.service;

import egovframework.com.platform.dbchange.model.DbChangeCaptureRequest;

public interface DbChangeCaptureService {

    void captureChange(DbChangeCaptureRequest request);
}

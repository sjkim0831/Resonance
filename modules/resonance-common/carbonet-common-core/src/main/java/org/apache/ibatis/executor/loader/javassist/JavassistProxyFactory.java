package org.apache.ibatis.executor.loader.javassist;

import org.apache.ibatis.executor.loader.ProxyFactory;
import org.apache.ibatis.session.Configuration;
import java.util.List;
import java.util.Properties;

public class JavassistProxyFactory implements ProxyFactory {
    public JavassistProxyFactory() {
        System.out.println("[Shadow JavassistProxyFactory] Stub instance created to bypass GraalVM ClassNotFoundException");
    }
    @Override
    public void setProperties(Properties properties) {
    }
    @Override
    public Object createProxy(Object target, org.apache.ibatis.executor.loader.ResultLoaderMap lazyLoader, Configuration configuration, org.apache.ibatis.reflection.factory.ObjectFactory objectFactory, List<Class<?>> constructorArgTypes, List<Object> constructorArgs) {
        return target;
    }
}

package egovframework.com.platform.governance.service;

import java.util.*;

/** Read-only catalog assembly; bindings never contribute to definition counts. */
final class ProcessCatalogAssembler {
    private static final Comparator<Object> VALUES = Comparator.nullsLast((a,b) ->
        a instanceof Number && b instanceof Number ? new java.math.BigDecimal(a.toString()).compareTo(new java.math.BigDecimal(b.toString())) : a.toString().compareTo(b.toString()));
    private static Comparator<Map<String,Object>> order(String... keys) {
        return (a,b) -> { for (String key:keys) { int c=VALUES.compare(a.get(key),b.get(key)); if(c!=0)return c; } return 0; };
    }
    static Map<String,Object> assemble(List<Map<String,Object>> types, List<Map<String,Object>> processes,
            List<Map<String,Object>> steps, List<Map<String,Object>> runtime) {
        List<Map<String,Object>> ts=new ArrayList<>(types); ts.sort(order("sort_order","workTypeCode"));
        Map<String,Map<String,Object>> ps=new TreeMap<>();
        for(var p:processes)ps.putIfAbsent(p.get("processCode").toString(),new LinkedHashMap<>(p));
        Map<List<Object>,Map<String,Object>> ss=new LinkedHashMap<>();
        Map<List<Object>,Set<List<Object>>> seen=new HashMap<>();
        for(var row:steps){
            var key=Arrays.asList(row.get("processCode"),row.get("stepCode"));
            var s=ss.computeIfAbsent(key,k->{var x=new LinkedHashMap<>(row); for(String f:List.of("bindingId","audience","routePath","screenResourceId","screenBindingStatus","implementationStatus"))x.remove(f); x.put("screenBindings",new ArrayList<Map<String,Object>>());return x;});
            if(row.get("screenResourceId")!=null){
                var bk=Arrays.asList(row.get("audience"),row.get("screenResourceId"),row.get("routePath"));
                if(seen.computeIfAbsent(key,k->new HashSet<>()).add(bk)){
                    Map<String,Object> binding=new LinkedHashMap<>();
                    for(String f:List.of("audience","routePath","screenResourceId","screenBindingStatus","implementationStatus"))binding.put(f,row.get(f));
                    bindings(s).add(binding);
                }
            }
        }
        Map<String,Map<String,Object>> rt=new HashMap<>(); long orphan=0;
        for(var r:runtime){String code=String.valueOf(r.get("processCode"));if(!ps.containsKey(code)){orphan+=((Number)r.getOrDefault("total",0)).longValue();continue;} rt.put(code,r);}
        for(var p:ps.values()){
            String code=p.get("processCode").toString();var children=new ArrayList<Map<String,Object>>();
            for(var s:ss.values())if(code.equals(s.get("processCode"))){bindings(s).sort(order("audience","screenResourceId","routePath"));children.add(s);}
            children.sort(order("stepOrder","stepCode"));p.put("steps",children);
            p.put("workspaceUrl","/admin/system/process-workspace?processCode="+java.net.URLEncoder.encode(code,java.nio.charset.StandardCharsets.UTF_8));
            p.put("runtimeSummary",rt.getOrDefault(code,Map.of("running",0L,"completed",0L,"failed",0L,"cancelled",0L,"total",0L)));
        }
        int bi=0;for(var t:ts){t=new LinkedHashMap<>(t);ts.set(bi,t);t.put("businessOrder",++bi);t.put("active","Y".equals(t.get("use_at")));
            var children=new ArrayList<Map<String,Object>>();for(var p:ps.values())if(String.valueOf(t.get("workTypeCode")).equalsIgnoreCase(String.valueOf(p.get("domainCode"))))children.add(p);
            children.sort(order("workflowOrder","developmentOrder","processCode"));int pi=0;for(var p:children){p.put("processOrder",++pi);p.put("displayNumber",bi+"-"+pi);}t.put("processes",children);
        }
        Map<String,Object> counts=new LinkedHashMap<>();counts.put("businessTypes",ts.size());counts.put("activeBusinessTypes",ts.stream().filter(t->Boolean.TRUE.equals(t.get("active"))).count());counts.put("processes",ps.size());counts.put("steps",ss.size());
        counts.put("activeProcesses",ps.values().stream().filter(ProcessCatalogAssembler::active).count());counts.put("retiredProcesses",ps.values().stream().filter(p->"RETIRED".equals(p.get("lifecycleStatus"))).count());counts.put("activeProcessSteps",ss.values().stream().filter(s->ps.containsKey(s.get("processCode"))&&active(ps.get(s.get("processCode")))).count());
        Map<String,Object> result=new LinkedHashMap<>();result.put("counts",counts);result.put("businessTypes",ts);result.put("orphanRuntimeCount",orphan);return result;
    }
    private static boolean active(Map<String,Object> p){return !Set.of("RETIRED","INACTIVE","DELETED").contains(String.valueOf(p.get("lifecycleStatus")));}
    @SuppressWarnings("unchecked") private static List<Map<String,Object>> bindings(Map<String,Object> s){return (List<Map<String,Object>>)s.get("screenBindings");}
}

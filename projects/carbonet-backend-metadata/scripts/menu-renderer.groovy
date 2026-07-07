/**
 * Menu Rendering Script
 * 수정 시 빌드/배포 불필요 - 파일 변경만으로 즉시 적용
 */
package carbonet.scripts

import java.util.Map

class MenuRenderer {
    
    static Map renderMenuItem(Map menuItem, Map context) {
        def result = [
            code: menuItem.code,
            name: menuItem.name,
            icon: menuItem.icon ?: 'default-icon',
            url: menuItem.url,
            visible: menuItem.visible ?: true,
            order: menuItem.order ?: 0
        ]
        
        // 권한 체크
        if (context?.user?.roles) {
            result.visible = hasPermission(menuItem, context.user.roles)
        }
        
        // 자식 메뉴가 있는 경우 재귀 처리
        if (menuItem.children) {
            result.children = menuItem.children.collect { child ->
                renderMenuItem(child, context)
            }.findAll { it.visible }
        }
        
        return result
    }
    
    static boolean hasPermission(Map menuItem, List roles) {
        def requiredRoles = menuItem.requiredRoles as List ?: []
        if (requiredRoles.isEmpty()) return true
        return roles.any { role -> requiredRoles.contains(role) }
    }
    
    static List buildMenuTree(List menus, Map context) {
        menus.collect { menu -> renderMenuItem(menu, context) }
               .findAll { it.visible }
               .sort { it.order }
    }
}

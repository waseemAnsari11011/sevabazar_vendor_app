import { createNavigationContainerRef, StackActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
    console.log(`[NavigationService] Navigating to: ${name}`, params ? `with params: ${JSON.stringify(params).substring(0, 100)}...` : '');
    if (navigationRef.isReady()) {
        navigationRef.navigate(name, params);
    } else {
        console.warn(`[NavigationService] Navigation requested for ${name} but navigator is NOT ready`);
    }
}

export function push(name, params) {
    console.log(`[NavigationService] PUSHING screen: ${name}`);
    if (navigationRef.isReady()) {
        navigationRef.dispatch(StackActions.push(name, params));
    } else {
        console.warn(`[NavigationService] Push requested for ${name} but navigator is NOT ready`);
    }
}

export function reset(name) {
    if (navigationRef.isReady()) {
        navigationRef.reset({
            index: 0,
            routes: [{ name }],
        });
    }
}

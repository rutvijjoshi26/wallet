import { useUser } from '@clerk/clerk-expo'
import { Redirect } from 'expo-router'
import { Stack } from 'expo-router'

export default function Layout() {
    const { isSignedIn, isLoaded } = useUser();

    if (!isLoaded) {
        return null; // this is to prevent flickering
    }

    if (!isSignedIn) {
        return <Redirect href={'/(auth)/sign-in'} />
    }
    return <Stack screenOptions={{ headerShown: false }}/>
}
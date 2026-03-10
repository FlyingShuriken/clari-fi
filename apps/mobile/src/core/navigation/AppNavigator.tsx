import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClariFiController } from '../state/clariFi-controller';
import { AlertsScreen } from '../../features/alerts/screens/AlertsScreen';
import { AccountScreen } from '../../features/auth/screens/AccountScreen';
import { CaptureScreen } from '../../features/capture/screens/CaptureScreen';
import { FamilyScreen } from '../../features/families/screens/FamilyScreen';
import { LedgerScreen } from '../../features/ledger/screens/LedgerScreen';
import { PricesScreen } from '../../features/prices/screens/PricesScreen';
import { ReportsScreen } from '../../features/reports/screens/ReportsScreen';
import { SplitsScreen } from '../../features/splits/screens/SplitsScreen';
import { StoreMapScreen } from '../../features/prices/screens/StoreMapScreen';
import { Colors, Shadows } from '../../theme';

export type MainTabParamList = {
  Home: undefined;
  Ledger: undefined;
  Reports: undefined;
  Prices: undefined;
  Alerts: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Account: undefined;
  Families: undefined;
  Splits: undefined;
  StoreMap: { items: string[]; lat: number; lng: number; radiusKm: number; areaText?: string };
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.bg,
    card: Colors.surfaceHigh,
    text: Colors.textPrimary,
    border: Colors.border,
    primary: Colors.green,
    notification: Colors.coral,
  },
};

type TabIconName = keyof typeof MaterialCommunityIcons.glyphMap;

function tabIcon(routeName: keyof MainTabParamList): TabIconName {
  switch (routeName) {
    case 'Home':    return 'home-outline';
    case 'Ledger':  return 'format-list-bulleted';
    case 'Reports': return 'trending-up';
    case 'Prices':  return 'tag-outline';
    case 'Alerts':  return 'bell-outline';
    default:        return 'circle-outline';
  }
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const controller = useClariFiController();

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.tabBarPill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const isAlerts = route.name === 'Alerts';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as keyof MainTabParamList);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[styles.tabItem, isFocused && styles.tabItemActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
            >
              <View style={styles.tabIconWrapper}>
                <MaterialCommunityIcons
                  name={tabIcon(route.name as keyof MainTabParamList)}
                  size={22}
                  color={isFocused ? Colors.green : Colors.textSecondary}
                />
                {isAlerts && controller.alertUnreadCount > 0 && (
                  <View style={styles.badgeDot}>
                    <Text style={styles.badgeText}>
                      {controller.alertUnreadCount > 9 ? '9+' : String(controller.alertUnreadCount)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { color: Colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen name="Home" component={CaptureScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Ledger" component={LedgerScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Prices" component={PricesScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const controller = useClariFiController();

  return (
    <View style={styles.container}>
      <NavigationContainer theme={navigationTheme}>
        <RootStack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: Colors.bg },
            headerTintColor: Colors.textPrimary,
            headerTitleStyle: { color: Colors.textPrimary, fontWeight: '700' },
            headerShadowVisible: false,
          }}
        >
          <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <RootStack.Screen
            name="Account"
            component={AccountScreen}
            options={{ presentation: 'modal', title: 'Settings' }}
          />
          <RootStack.Screen name="Families" component={FamilyScreen} options={{ title: 'Families' }} />
          <RootStack.Screen name="Splits" component={SplitsScreen} options={{ title: 'Splits' }} />
          <RootStack.Screen name="StoreMap" component={StoreMapScreen} options={{ title: 'Store Comparison', headerBackTitle: 'Back' }} />
        </RootStack.Navigator>
      </NavigationContainer>

      <Snackbar
        visible={Boolean(controller.message)}
        onDismiss={controller.clearMessage}
        duration={4000}
        style={styles.snackbar}
        theme={{ colors: { surface: Colors.surfaceHigh, onSurface: Colors.textPrimary } }}
      >
        {controller.message}
      </Snackbar>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  tabBarPill: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 31,
    height: 62,
    paddingHorizontal: 8,
    alignItems: 'center',
    width: '100%',
    ...Shadows.tabBar,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    paddingVertical: 6,
    gap: 2,
  },
  tabItemActive: {
    backgroundColor: '#32D58318',
  },
  tabIconWrapper: {
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: Colors.coral,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.green,
    fontWeight: '600',
  },
  snackbar: {
    margin: 16,
    marginBottom: 90,
  },
});

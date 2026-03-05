import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { createBottomTabNavigator, type BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Snackbar } from 'react-native-paper';
import { useClariFiController } from '../state/clariFi-controller';
import { AlertsScreen } from '../../features/alerts/screens/AlertsScreen';
import { AccountScreen } from '../../features/auth/screens/AccountScreen';
import { CaptureScreen } from '../../features/capture/screens/CaptureScreen';
import { FamilyScreen } from '../../features/families/screens/FamilyScreen';
import { LedgerScreen } from '../../features/ledger/screens/LedgerScreen';
import { PricesScreen } from '../../features/prices/screens/PricesScreen';
import { ReportsScreen } from '../../features/reports/screens/ReportsScreen';
import { SplitsScreen } from '../../features/splits/screens/SplitsScreen';

export type MainTabParamList = {
  Capture: undefined;
  Ledger: undefined;
  Reports: undefined;
  Families: undefined;
  Splits: undefined;
  Prices: undefined;
  Alerts: undefined;
  Account: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
type RootStackParamList = {
  MainTabs: undefined;
};
const RootStack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f8fafc',
    card: '#ffffff',
    text: '#0f172a',
    border: '#e2e8f0',
    primary: '#0f766e',
    notification: '#b91c1c',
  },
};

function tabIconName(routeName: keyof MainTabParamList): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (routeName) {
    case 'Capture':
      return 'microphone-outline';
    case 'Ledger':
      return 'book-open-page-variant-outline';
    case 'Reports':
      return 'chart-line';
    case 'Families':
      return 'account-group-outline';
    case 'Splits':
      return 'call-split';
    case 'Prices':
      return 'store-search-outline';
    case 'Alerts':
      return 'bell-outline';
    case 'Account':
      return 'account-circle-outline';
    default:
      return 'circle-outline';
  }
}

function screenOptions({ route }: { route: { name: keyof MainTabParamList } }): BottomTabNavigationOptions {
  return {
    tabBarIcon: ({ color, size }) => (
      <MaterialCommunityIcons name={tabIconName(route.name)} color={color} size={size} />
    ),
    headerTitleStyle: {
      fontWeight: '700',
      color: '#0f172a',
    },
    headerStyle: {
      backgroundColor: '#ffffff',
    },
    tabBarActiveTintColor: '#0f766e',
    tabBarInactiveTintColor: '#64748b',
    tabBarStyle: {
      backgroundColor: '#ffffff',
      borderTopColor: '#e2e8f0',
      height: 62,
      paddingBottom: 8,
      paddingTop: 6,
    },
  };
}

export function AppNavigator() {
  const controller = useClariFiController();

  return (
    <View style={styles.container}>
      <NavigationContainer theme={navigationTheme}>
        <RootStack.Navigator>
          <RootStack.Screen
            name="MainTabs"
            options={{ headerShown: false }}
            children={() => (
              <Tab.Navigator initialRouteName="Capture" screenOptions={screenOptions}>
                <Tab.Screen name="Capture" component={CaptureScreen} />
                <Tab.Screen name="Ledger" component={LedgerScreen} />
                <Tab.Screen name="Reports" component={ReportsScreen} />
                <Tab.Screen name="Families" component={FamilyScreen} />
                <Tab.Screen name="Splits" component={SplitsScreen} />
                <Tab.Screen name="Prices" component={PricesScreen} />
                <Tab.Screen
                  name="Alerts"
                  component={AlertsScreen}
                  options={{
                    tabBarBadge:
                      controller.alertUnreadCount > 0 ? controller.alertUnreadCount : undefined,
                  }}
                />
                <Tab.Screen name="Account" component={AccountScreen} />
              </Tab.Navigator>
            )}
          />
        </RootStack.Navigator>
      </NavigationContainer>

      <Snackbar
        visible={Boolean(controller.message)}
        onDismiss={controller.clearMessage}
        duration={4000}
        style={styles.snackbar}
      >
        {controller.message}
      </Snackbar>

      {controller.loading ? <ActivityIndicator style={styles.loadingOverlay} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  snackbar: {
    margin: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    right: 18,
    top: 14,
  },
});

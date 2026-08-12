import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = 'appLanguage';
const DEFAULT_LANGUAGE = 'en';

export const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'gu', label: 'ગુજરાતી' },
];

const translations = {
  en: {
    selectLanguage: 'Select Language',
    employeeLogin: 'Employee Login',
    createAccount: 'Create Account',
    employeeId: 'Employee ID (e.g. EMP001)',
    fullName: 'Full Name',
    password: 'Password',
    missingInfo: 'Missing info',
    fillAllFields: 'Please fill all fields.',
    register: 'Register',
    logIn: 'Log In',
    alreadyHaveAccount: 'Already have an account? Log In',
    newEmployeeRegister: 'New employee? Register here',
    permissionRequired: 'Permission Required',
    locationPermissionNeeded: 'Allow Location',
    backgroundPermissionNeeded: 'Allow Location',
    allowLocation: 'Allow Location',
    enableLocation: 'Enable',
    settings: 'Settings',
    locationPermissionBanner: 'Allow Location',
    changeLanguage: 'Change Language',
    logout: 'Log Out',
    modeOfTransport: 'Mode of Transport',
    personalVehicle: 'Personal Vehicle',
    publicTransport: 'Public Transport',
    officeVehicle: 'Office Vehicle',
    captureStartOdometer: '📷 Capture start odometer',
    captureEndOdometer: '📷 Capture end odometer',
    captureTicketMorning: '📷 Capture ticket (morning)',
    captureTicketEvening: '📷 Capture ticket (evening)',
    captureOfficeVehiclePhoto: '📷 Capture office vehicle photo',
    captureStart: '📷 Capture Start',
    captureEnd: '📷 Capture End',
    photoInstructionsDefault: 'Select a transport mode first to see the correct photo instructions.',
    photoInstructionsSelected: 'Capture two photos: start/morning and end/evening for the selected transport mode.',
    start: 'START',
    end: 'END',
    validationTransportMode: 'Please select a transport mode.',
    validationStartPhoto: 'Please capture the start/morning photo.',
    validationEndPhoto: 'Please capture the end/evening photo.',
    successStarted: 'Started at',
    successEnded: 'Ended at',
    errorRecordStart: 'Could not record start punch. Check location and network.',
    errorRecordEnd: 'Could not record end punch.',
    locationOffTitle: 'Location is turned off',
    locationOffMessage: 'Please turn on Location/GPS to proceed, then tap Retry.',
    unclearPhotoTitle: 'Unclear photo',
    unclearPhoto: 'That photo looks blank or unclear (too dark/too bright). Please retake it.',
    errorTitle: 'Error',
    cameraError: 'Camera Error',
    failedOpenCamera: 'Failed to open camera.',
    noPhotoCaptured: 'No photo captured.',
    retake: 'Retake',
    morning: 'Morning',
    evening: 'Evening',
    readyToEndDay: 'Ready to end your day?',
    validationTitle: 'Validation Error',
    permissionNeededTitle: 'Permission needed',
    allow: 'Allow',
    cancel: 'Cancel',
    locationEnabled: 'Location enabled',
    locationEnabledMessage: 'Location permission is now allowed.',
    unableToOpenSettings: 'Unable to open settings',
    pleaseEnableFromSettings: 'Please enable location permission from your device settings.',
    offlineSavedMessage: 'Saved offline and will upload automatically when the connection returns.',
  },
  hi: {
    selectLanguage: 'भाषा चुनें',
    employeeLogin: 'कर्मचारी लॉगिन',
    createAccount: 'खाता बनाएं',
    employeeId: 'कर्मचारी आईडी (जैसे EMP001)',
    fullName: 'पूरा नाम',
    password: 'पासवर्ड',
    missingInfo: 'जानकारी गायब है',
    fillAllFields: 'कृपया सभी फ़ील्ड भरें।',
    register: 'पंजीकरण',
    logIn: 'लॉग इन',
    alreadyHaveAccount: 'पहले से खाता है? लॉग इन करें',
    newEmployeeRegister: 'नया कर्मचारी? यहाँ पंजीकरण करें',
    permissionRequired: 'अनुमति आवश्यक है',
    locationPermissionNeeded: 'स्थान की अनुमति दें',
    backgroundPermissionNeeded: 'स्थान की अनुमति दें',
    allowLocation: 'स्थान की अनुमति दें',
    enableLocation: 'सक्षम करें',
    settings: 'सेटिंग्स',
    locationPermissionBanner: 'स्थान की अनुमति दें',
    changeLanguage: 'भाषा बदलें',
    logout: 'लॉग आउट',
    modeOfTransport: 'यातायात का तरीका',
    personalVehicle: 'व्यक्तिगत वाहन',
    publicTransport: 'सार्वजनिक परिवहन',
    officeVehicle: 'कार्यालय वाहन',
    captureStartOdometer: '📷 प्रारंभ ओडोमीटर कैप्चर करें',
    captureEndOdometer: '📷 अंतिम ओडोमीटर कैप्चर करें',
    captureTicketMorning: '📷 टिकट कैप्चर करें (सुबह)',
    captureTicketEvening: '📷 टिकट कैप्चर करें (शाम)',
    captureOfficeVehiclePhoto: '📷 कार्यालय वाहन फोटो कैप्चर करें',
    captureStart: '📷 प्रारंभ कैप्चर करें',
    captureEnd: '📷 समाप्ति कैप्चर करें',
    photoInstructionsDefault: 'सही फ़ोटो निर्देश देखने के लिए पहले यातायात का तरीका चुनें।',
    photoInstructionsSelected: 'चयनित यातायात के तरीके के लिए प्रारंभ/सुबह और अंत/शाम के लिए दो फ़ोटो लें।',
    start: 'प्रारंभ',
    end: 'समाप्त',
    validationTransportMode: 'कृपया एक यातायात का तरीका चुनें।',
    validationStartPhoto: 'कृपया प्रारंभ/सुबह की फोटो लें।',
    validationEndPhoto: 'कृपया समाप्ति/शाम की फोटो लें।',
    successStarted: 'शुरू किया गया',
    successEnded: 'समाप्त किया गया',
    errorRecordStart: 'प्रारंभ पंच रिकॉर्ड नहीं किया जा सका। स्थान और नेटवर्क जांचें।',
    errorRecordEnd: 'समाप्त पंच रिकॉर्ड नहीं किया जा सका।',
    locationOffTitle: 'स्थान बंद है',
    locationOffMessage: 'कृपया जारी रखने के लिए स्थान/GPS चालू करें, फिर फिर से प्रयास करें।',
    unclearPhotoTitle: 'अस्पष्ट फोटो',
    unclearPhoto: 'उस फोटो में कुछ भी स्पष्ट नहीं दिख रहा है (बहुत अंधेरा/बहुत उज्जवल)। कृपया पुनः लें।',
    errorTitle: 'त्रुटि',
    cameraError: 'कैमरा त्रुटि',
    failedOpenCamera: 'कैमरा खोलने में असफल।',
    noPhotoCaptured: 'कोई फोटो कैप्चर नहीं हुई।',
    retake: 'पुनः लें',
    morning: 'सुबह',
    evening: 'शाम',
    readyToEndDay: 'क्या आप अपने दिन को समाप्त करने के लिए तैयार हैं?',
    validationTitle: 'मान्यकरण त्रुटि',
    permissionNeededTitle: 'अनुमति आवश्यक है',
    allow: 'अनुमति दें',
    cancel: 'रद्द करें',
    locationEnabled: 'स्थान सक्षम किया गया',
    locationEnabledMessage: 'स्थान अनुमति अब स्वीकृत है।',
    unableToOpenSettings: 'सेटिंग्स खोलने में असमर्थ',
    pleaseEnableFromSettings: 'कृपया अपने डिवाइस सेटिंग्स से स्थान अनुमति सक्षम करें।',
    offlineSavedMessage: 'ऑफलाइन में सुरक्षित किया गया और कनेक्शन लौटने पर स्वचालित रूप से अपलोड किया जाएगा।',
  },
  gu: {
    selectLanguage: 'ભાષા પસંદ કરો',
    employeeLogin: 'કર્મચારી લોગિન',
    createAccount: 'ખાતું બનાવો',
    employeeId: 'કર્મચારી ID (જેમ કે EMP001)',
    fullName: 'પૂર્ણ નામ',
    password: 'પાસવર્ડ',
    missingInfo: 'માહિતી ગાયબ છે',
    fillAllFields: 'કૃપા કરીને બધા ક્ષેત્રો ભરો.',
    register: 'રજીસ્ટર',
    logIn: 'લોગ ઇન',
    alreadyHaveAccount: 'પહેલાંથી એક ખાતું છે? લોગ ઇન કરો',
    newEmployeeRegister: 'નવો કર્મચારી? અહીં રજીસ્ટર કરો',
    permissionRequired: 'અનુમતિ જરૂરી છે',
    locationPermissionNeeded: 'સ્થળની અનુમતિ આપો',
    backgroundPermissionNeeded: 'સ્થળની અનુમતિ આપો',
    allowLocation: 'સ્થળની અનુમતિ આપો',
    enableLocation: 'સક્ષમ કરો',
    settings: 'સેટિંગ્સ',
    locationPermissionBanner: 'સ્થળની અનુમતિ આપો',
    changeLanguage: 'ભાષા બદલો',
    logout: 'લૉગ આઉટ',
    modeOfTransport: 'પરિવહનનો માર્ગ',
    personalVehicle: 'વ્યક્તિગત વાહન',
    publicTransport: 'જાહેર પરિવહન',
    officeVehicle: 'ઑફિસ વાહન',
    captureStartOdometer: '📷 સ્ટાર્ટ ઓડોમીટર ધરવો',
    captureEndOdometer: '📷 અંત ઓડોમીટર રાખો',
    captureTicketMorning: '📷 ટિકિટ ધરાવો (સવાર)',
    captureTicketEvening: '📷 ટિકિટ ધરાવો (સંધ્યા)',
    captureOfficeVehiclePhoto: '📷 ઓફિસ વાહન ફોટો ધરાવો',
    captureStart: '📷 શરૂ કરો',
    captureEnd: '📷 પૂર્ણ કરો',
    photoInstructionsDefault: 'જરૂરી ફોટો સૂચનાઓ જોવા માટે પહેલા પરિવહનનો માર્ગ પસંદ કરો.',
    photoInstructionsSelected: 'પસંદ કરેલ પરિવહન માટે સ્ટાર્ટ/સવાર અને એન્ડ/સંધ્યા માટે બે તસવીરો લો.',
    start: 'શરૂ',
    end: 'અંતુ',
    validationTransportMode: 'કૃપા કરીને પરિવહનનો માર્ગ પસંદ કરો.',
    validationStartPhoto: 'કૃપા કરીને સ્ટાર્ટ/સવાર ફોટો લો.',
    validationEndPhoto: 'કૃપા કરીને અંત/સંધ્યા ફોટો લો.',
    successStarted: 'શરુ કર્યું',
    successEnded: 'સમાપ્ત કર્યું',
    errorRecordStart: 'શરૂઆતનું પંચ રેકોર્ડ કરી શકાતું નથી. સ્થાન અને નેટવર્ક તપાસો.',
    errorRecordEnd: 'અંતનો પંચ રેકોર્ડ કરી શકાતો નથી.',
    locationOffTitle: 'સ્થળ બંધ છે',
    locationOffMessage: 'જારી રાખવા માટે અથવા પછીથી ફરીથી પ્રયાસ કરવા માટે કૃપા કરીને સ્થાન/GPS ચાલુ કરો.',
    unclearPhotoTitle: 'અસ્પષ્ટ ફોટો',
    unclearPhoto: 'તે ફોટો સ્પષ્ટ નથી લાગતો (ખૂબ અંધારું/ખૂબ તેજ). કૃપા કરીને ફરીથી લો.',
    errorTitle: 'ત્રુટિ',
    cameraError: 'કેમેરા ભૂલ',
    failedOpenCamera: 'કેમેરા ખુલ્યો નહીં.',
    noPhotoCaptured: 'કોઈ ફોટો કૅપચર થયો નથી.',
    retake: 'ફરીથી લો',
    morning: 'સવાર',
    evening: 'સાંજ',
    readyToEndDay: 'શું તમે તમારા દિવસને પૂર્ણ કરવા તૈયાર છો?',
    validationTitle: 'માન્યતા ભૂલ',
    permissionNeededTitle: 'અનુમતિ જરૂરી છે',
    allow: 'અનુમતિ આપો',
    cancel: 'રદ્દ કરો',
    locationEnabled: 'સ્થળ સક્ષમ કર્યું',
    locationEnabledMessage: 'સ્થળની અનુમતિ હવે મંજૂર કરવામાં આવી છે.',
    unableToOpenSettings: 'સેટિંગ્સ ખોલી શકાતું નથી',
    pleaseEnableFromSettings: 'કૃપા કરીને તમારા ડિવાઇસ સેટિંગ્સમાંથી સ્થાન અનુમતિ સક્ષમ કરો.',
    offlineSavedMessage: 'આપણે ઓફલાઈનમાં સેવ કર્યું છે અને કનેક્શન પાછું આવે તો તે આપમેળે અપલોડ થઈ જશે.',
  },
};

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((saved) => {
      if (saved && translations[saved]) {
        setLanguageState(saved);
      }
    });
  }, []);

  const setLanguage = async (newLanguage) => {
    if (!translations[newLanguage]) return;
    setLanguageState(newLanguage);
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, newLanguage);
    } catch {
      // ignore storage errors
    }
  };

  const t = (key) => {
    return translations[language]?.[key] || translations[DEFAULT_LANGUAGE]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}


/*Importing required libs*/
#include "DHT.h"
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h> // Provide the token generation process info.
#include <ESP32Servo.h> 
#include <CD74HC4067.h> // For analog mux IC

//Firebase and WiFi credentials
#define API_KEY "AIzaSyCb-ZCOOAdIDxyEN_sFCB7QodeCaEQtZVo"
#define FIREBASE_PROJECT_ID "smart-agriot"
#define WIFI_SSID "Omkar"
#define WIFI_PASSWORD "india@75"
#define USER_EMAIL "smartagriot1@gmail.com"
#define USER_PASSWORD "SmartAgrIOT@123"
// Define Firebase Data object
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

//Buzzer credentials
int freq = 2000;
int channel = 0;
int resolution = 8;
int dutyCycle = 128;

#define DHTPIN 21     // DHT connected to pin 32
#define DHTTYPE DHT22 // create an instance of DHT sensor
// Initializing DHT sensor
DHT dht(DHTPIN, DHTTYPE);
float h = 0.0;
float t = 0.0;

Servo myservo;  // create servo object to control a servo motor
int pos = 0;
int n;


const byte buzzerPin = 15; //buzzerPin = 15;
#define MOTION_SENSOR_PIN1  32  // ESP32 pin GPIO15 connected to the OUTPUT pin of motion sensor
#define SOILPIN 34     // DHT connected to pin 
CD74HC4067 my_mux(4,16,17,18); //Select lines for analog mux and demux
CD74HC4067 secure_mux(25,26,27,14);
int motionStateCurrent;
int TR=1500;
int flag=1;
int d=20;

// Manual mode soil sensor controls(user control parameters)
int w;
int NS=0;
int THRES[5];
int vlv_1[5];
 
// strings of manual controls
String vlv_1_str;
String mode_op_str;
String THRES_str;
String NF_str;
String NS_str;


// Status Signals
int mode_op=1;
int first= 1;

//For timing calculations
long int t1 = millis();
bool Time;


//For multithreading
TaskHandle_t Task1;     //, Task1;

//Function for conneting with firebase and firebase database
void WiFiConnection()
{   long int t2 = millis();

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD); // connecting to WIFI
    Serial.print("Connecting to Wi-Fi");

    while (WiFi.status() != WL_CONNECTED) // Waiting(looping) until WIFI is connected
    {   
        if (millis()-t2<8000){
         Serial.print(".");
         delay(500);}
        else{
          break;
        }
    }

    Serial.print("Connected with IP: ");
    Serial.println(WiFi.localIP()); // printing IP address if connected to WIFI

    Serial.printf("Firebase Client v%s\n\n", FIREBASE_CLIENT_VERSION);
    /* Assign the api key (required) */
    config.api_key = API_KEY;

    /* Assign the user sign in credentials */
    auth.user.email = USER_EMAIL;
    auth.user.password = USER_PASSWORD;
    /* Assign the callback function for the long running token generation task */
    config.token_status_callback = tokenStatusCallback; // see addons/TokenHelper.h
     fbdo.setResponseSize(2048);

    Firebase.begin(&config, &auth);

    Firebase.reconnectWiFi(true);
    
}

//To detect the motion using PIR sensor
void detect(){ 
 
 for (int x=0; x<4;x++){
  
 secure_mux.channel(x);//Selecting channel
  delay(50);
 digitalWrite(12, LOW);
 delay(100);
 
    motionStateCurrent = analogRead(MOTION_SENSOR_PIN1); //Reading the analog value
     delay(100);
     digitalWrite(12, HIGH);
     Serial.print("Motion sensor out");
     Serial.println(motionStateCurrent);
     delay(1000);
    if ( motionStateCurrent > TR) { // pin state change: LOW -> HIGH 
      digitalWrite(12, LOW);
       delay(100);
 
    motionStateCurrent = analogRead(MOTION_SENSOR_PIN1);
     delay(100);
     digitalWrite(12, HIGH);
      
      while(motionStateCurrent >TR){
        flag=1;
        if (NS==0){
        ledcWrite(channel, dutyCycle);// Buzzer turn on
        }
        d = x;
        delay(2500);
        Serial.println("Inside the loop");
       digitalWrite(12, LOW);
        delay(100);
 
        motionStateCurrent = analogRead(MOTION_SENSOR_PIN1);
         delay(100);
         digitalWrite(12, HIGH);
        Serial.print("Motion sensor in");
        Serial.println(motionStateCurrent);      
      }
       ledcWrite(channel, 0);// Buzzer turn off
      Serial.println("After the loop");
  
     }
     d=20;
     Serial.println("No movement");
}
}

//Used in multithreading 
void codeForTask1( void * parameter )
{
  for (;;) {
    delay(10000);
    for (int i=0;i<5; i++){
    for (int i = pos; i <= pos+60; i ++) { 
      // myservo.write(pos); 
      delay(15);}
      detect();
      delay(50);
    }
    for (int i=0; i<5; i=i++) {
      for (int i = pos; i >= pos-60 ; i --) { 
    //myservo.write(pos); 
      delay(15);}
      detect();
      delay(50);
    }

  }
    
  }




// the setup function runs once when you press reset or power the board
void setup() {
  Serial.begin(115200);
  WiFiConnection();
   dht.begin();

    
    // Buzzer
   ledcSetup(channel, freq, resolution);
   ledcAttachPin(buzzerPin, channel);
   pinMode(23, OUTPUT);//AC motor enable active low.

  pinMode(19,OUTPUT);//Mux enable  active low
  pinMode(5, OUTPUT);//Buzzer
  pinMode(12, OUTPUT);//AC motor enable active low.
  digitalWrite(19, HIGH);//Active high mux enable
  digitalWrite(23, HIGH);//Demux active low enable
  digitalWrite(12, HIGH);

  
 
    // Defining input pins for soil 
  pinMode(SOILPIN, INPUT);

  pinMode(MOTION_SENSOR_PIN1,INPUT);// PIR sensor


  
  myservo.attach(13);

  
  xTaskCreatePinnedToCore(
    codeForTask1,
    "led1Task",
    20000,
    NULL,
    1,
    &Task1,
    0);
  delay(100);  // needed to start-up task1

  
}



void loop() {
 
  //Retrieving required values from firebase
  FirebaseJson content;
  String documentPath = "Farm/1001";
    Serial.print("Get a document... ");
    if (WiFi.status() == WL_CONNECTED && Firebase.Firestore.getDocument(&fbdo, FIREBASE_PROJECT_ID, "", documentPath.c_str(),"P0.MAN_WATER0, P0.THRES_0, P1.MAN_WATER1,P1.THRES_1, P2.MAN_WATER2, P2.THRES_2, P3.MAN_WATER3, P3.THRES_3, mode,NOT_SECUR")){
    FirebaseJson payload;
    payload.setJsonData(fbdo.payload().c_str());
    FirebaseJsonData jsonData;
    payload.get(jsonData, "fields/NOT_SECUR/stringValue", true);
    NS_str = jsonData.stringValue;
    NS = NS_str.toInt();

    //Determining mode
    payload.get(jsonData, "fields/mode/stringValue", true);
    mode_op_str = jsonData.stringValue;
    mode_op = mode_op_str.toInt();


    for (int x=0; x<4;x++){
    String thr="fields/P"+String(x)+"/mapValue/fields/THRES_"+String(x)+"/stringValue";
    payload.get(jsonData, thr, true);
    THRES_str =jsonData.stringValue;
    THRES[x] = THRES_str.toInt();
      Serial.print("thr:");
     Serial.print(x);
     Serial.print(THRES[x]);

    String a ="fields/P"+String(x)+"/mapValue/fields/MAN_WATER"+String(x)+"/stringValue";
     payload.get(jsonData, a, true);
     vlv_1_str =jsonData.stringValue;
     vlv_1[x] = vlv_1_str.toInt();
     Serial.print("vlv:");
     Serial.print(x);
     Serial.print(vlv_1[x]);
     
    }
    }
    

//Used as timer in automatic mode
  if((millis()-t1 >10000)&&(first!=1)&&Time==true){
    Time=false;
  }
  else{
    Time=true;

}


 //For first time, setting the values in firebase
 if (first==1){
  if (WiFi.status() == WL_CONNECTED){
 int x=0;
 for (x=0; x<4;x++){

 my_mux.channel(x);
 delay(50);
 digitalWrite(19, LOW);
 delay(100);
 
    int w = analogRead(SOILPIN);//Reading analog value.
     delay(100);
     digitalWrite(19, HIGH);
     if( w < THRES[x]){
       n=0;
     }
     else{
      n=1;
     }
     //Sending values to firebase
    String b = "fields/P"+String(x)+"/mapValue/fields/"+"/MOIS_STATUS"+ String(x)+"/integerValue";
    content.clear();
    content.set(b, String(n).c_str());
    if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "" /* databaseId can be (default) or empty */, documentPath.c_str(), content.raw(), "P"+String(x)+".MOIS_STATUS"+String(x) /* updateMask */))
            {Serial.printf("ok\n%s\n\n", fbdo.payload().c_str());}
    else
            Serial.println(fbdo.errorReason());
  }
  }
  first=0;
  Time=false;
  }


bool Print=Time;
 //For automatic mode:
if (mode_op == 1 && Time==false ){
  digitalWrite(23, HIGH);//Watering off
  digitalWrite(19,HIGH);
 int x=0;
 Time=true;
 for (x=0; x<4;x++){
  
 my_mux.channel(x);
 delay(50);
 digitalWrite(19, LOW);
 delay(100);
    int w = analogRead(SOILPIN);
    delay(100);
    digitalWrite(19, HIGH);
    Serial.print("Analog read is:");
    Serial.println(w);
    delay(500);
    if( w < THRES[x]){//Checking whether to water the plant or not
      Time=Time && false;
      digitalWrite(23,LOW);//Watering  on

      Serial.print("23 low:");
      if (WiFi.status() == WL_CONNECTED){
      content.clear();
    content.set("fields/CURR_WATER/integerValue", String(x).c_str());
     if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "" /* databaseId can be (default) or empty */, documentPath.c_str(), content.raw(), "CURR_WATER" /* updateMask */))
            {Serial.printf("ok\n%s\n\n", fbdo.payload().c_str());}
      else
            Serial.println(fbdo.errorReason());
    }
      delay(10000); //Watering for 10 seconds
      digitalWrite(23, HIGH);//Watering off
    if (WiFi.status() == WL_CONNECTED){
    content.clear();
    content.set("fields/CURR_WATER/integerValue", String(20).c_str());
     if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "" /* databaseId can be (default) or empty */, documentPath.c_str(), content.raw(), "CURR_WATER" /* updateMask */))
            {Serial.printf("ok\n%s\n\n", fbdo.payload().c_str());}
      else
            Serial.println(fbdo.errorReason());
    }

      delay(50);
      digitalWrite(19, LOW);
      delay(100);
     w = analogRead(SOILPIN);
    delay(100);
    digitalWrite(19, HIGH);
    Serial.print("Analog read is:");
    Serial.println(w);

      if( w < THRES[x]){
       n=0;
     }
     else{
      n=1;
     }
     if (WiFi.status() == WL_CONNECTED){
    String b = "fields/P"+String(x)+"/mapValue/fields/"+"/MOIS_STATUS"+ String(x)+"/integerValue";
    content.clear();
    content.set(b, String(n).c_str());
     if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "" /* databaseId can be (default) or empty */, documentPath.c_str(), content.raw(), "P"+String(x)+".MOIS_STATUS"+String(x) /* updateMask */))
            {Serial.printf("ok\n%s\n\n", fbdo.payload().c_str());}
      else
            Serial.println(fbdo.errorReason());
    }
    }
    else{
     digitalWrite(23,HIGH);//Watering off
    Time = Time && true;
    }
    }
    t1=millis();
    delay(1000);
    }



    //For manual mode
    else if( mode_op==0 && WiFi.status() == WL_CONNECTED)
    {digitalWrite(23,HIGH);//Watering off
    digitalWrite(19,HIGH);
  
      for (int i=0; i<4; i++){
        
   if( vlv_1[i] == 1){
    my_mux.channel(i);
    delay(100);
    digitalWrite(23, LOW);//Watering on
    content.clear();
    content.set("fields/CURR_WATER/integerValue", String(i).c_str());
     if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "" /* databaseId can be (default) or empty */, documentPath.c_str(), content.raw(), "CURR_WATER" /* updateMask */))
            {Serial.printf("ok\n%s\n\n", fbdo.payload().c_str());}
      else
            Serial.println(fbdo.errorReason());
    delay(10000);
    digitalWrite(23, HIGH);//Watering off
    content.clear();
    content.set("fields/CURR_WATER/integerValue", String(20).c_str());
     if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "" /* databaseId can be (default) or empty */, documentPath.c_str(), content.raw(), "CURR_WATER" /* updateMask */))
            {Serial.printf("ok\n%s\n\n", fbdo.payload().c_str());}
      else
            Serial.println(fbdo.errorReason());
    delay(50);
    }

    digitalWrite(23,HIGH);//Watering off
    delay(100);
    digitalWrite(19,LOW);
    int w = analogRead(SOILPIN);
    delay(100);
    digitalWrite(19,HIGH);
    if( w < THRES[i]){
       n=0;
     }
     else{
      n=1;
     }
    
    String b = "fields/P"+String(i)+"/mapValue/fields/"+"/MOIS_STATUS"+ String(i)+"/integerValue";
    content.clear();
    content.set(b, String(n).c_str());
     if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "" /* databaseId can be (default) or empty */, documentPath.c_str(), content.raw(), "P"+String(i)+".MOIS_STATUS"+String(i) /* updateMask */))
            {Serial.printf("ok\n%s\n\n", fbdo.payload().c_str());}
      else
            Serial.println(fbdo.errorReason());
    }
    }



   

    // Reading data from DHT22
    h = dht.readHumidity();    // Read humidity in percentage
    t = dht.readTemperature(); // Read temperature in Celsius
    delay(1000);
    // Check if any reads failed and exit early (to try again).
    if (isnan(h) || isnan(t))
    {
        Serial.println("Failed to read from DHT sensor!");
    }

   
    if (t>55) { 
      int f=1;
     if( WiFi.status() == WL_CONNECTED){
    content.clear();
    content.set("fields/FIRE/integerValue", String(f).c_str());
     if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "" /* databaseId can be (default) or empty */, documentPath.c_str(), content.raw(), "FIRE" /* updateMask */))
            {Serial.printf("ok\n%s\n\n", fbdo.payload().c_str());}
      else
            Serial.println(fbdo.errorReason());
     }
      ledcWrite(channel, dutyCycle);// Buzzer turn on
      
      } 
      
    else { 
    
      ledcWrite(channel, 0);// Buzzer turn off
      int f=0;
     if( WiFi.status() == WL_CONNECTED){
      content.clear();
      content.set("fields/FIRE/integerValue", String(f).c_str());
     if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "" /* databaseId can be (default) or empty */, documentPath.c_str(), content.raw(), "FIRE" /* updateMask */))
            {Serial.printf("ok\n%s\n\n", fbdo.payload().c_str());}
      else
            Serial.println(fbdo.errorReason());
     }
    }

        
    if (motionStateCurrent > TR ) { 
     if( WiFi.status() == WL_CONNECTED){

    content.clear();
    content.set("fields/SECUR_PIN/integerValue", String(d).c_str());
     if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "" /* databaseId can be (default) or empty */, documentPath.c_str(), content.raw(), "SECUR_PIN" /* updateMask */))
            {Serial.printf("ok\n%s\n\n", fbdo.payload().c_str());}
      else
            Serial.println(fbdo.errorReason());
     }
      flag=1;
      } 
    
      else if (motionStateCurrent < TR  && flag==1) { 
      if(WiFi.status() == WL_CONNECTED){
      content.clear();
      content.set("fields/SECUR_PIN/integerValue", String(d).c_str());
     if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "" /* databaseId can be (default) or empty */, documentPath.c_str(), content.raw(), "SECUR_PIN" /* updateMask */))
            {Serial.printf("ok\n%s\n\n", fbdo.payload().c_str());}
      else
            Serial.println(fbdo.errorReason());
      }
     
      flag=0;
      } 
    if (Print==false){
     // print the result to Terminal
    Serial.print("Humidity: ");
    Serial.print(h);
    Serial.print(" %\t");
    Serial.print("Temperature: ");
    Serial.print(t);

    //we delay a little bit for next read
    delay(50);
    if (WiFi.status() == WL_CONNECTED){
    // flushing data to firebase
    Serial.println("Sending data");
    content.clear();
    content.set("fields/temp/doubleValue", String(t).c_str());
    content.set("fields/humid/doubleValue", String(h).c_str());
     if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "" /* databaseId can be (default) or empty */, documentPath.c_str(), content.raw(), "temp, humid" /* updateMask */))
            {Serial.printf("ok\n%s\n\n", fbdo.payload().c_str());}
      else
            Serial.println(fbdo.errorReason());
    }
   

   
  }
}

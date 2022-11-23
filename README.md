# ussd-service
Africa's Talking integration via MoleculerJS based service to deliver Agrimint USSD UX and SMS delivery 

# Settings 

The settings are done via .env file

```
AT_KEY="AFRICAS TALKING API KEY"
USER_API="BACK-END API ENDPOINT"
USSD_PORT=3333
```

# AT API Key

To get API key for Africas Talking, first register  [here](https://account.africastalking.com/).
Then go to Sandbox/Settings and get API key for the SMS.
For the USSD go to USSD/Service codes, 
Create a channel, select Service code and then set callback `<ussd-service.deployment>/ussd`

Now you can Launch simulator and test the USSD experience.
 

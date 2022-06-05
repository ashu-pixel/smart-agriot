from flask import Flask,jsonify,request,make_response
import pickle
import numpy as np

app=Flask(__name__)
# Load model from model.pkl
Wmodel = pickle.load(open('weather_prediction.pkl', 'rb'))
Cmodel = pickle.load(open('model.pkl', 'rb'))

@app.route('/' )
def hm():
    response = "HELLO WORLD from SMART-AgrIoT"
    resp = {"ans" : response } 
    return jsonify(resp)


@app.route('/weatherPred',methods = ['POST', 'GET'])
def predict():
    if request.method == 'POST':
        content_type = request.headers.get('Content-Type')
        print("content_type",content_type)
        if (content_type == 'application/json'):
            data = request.json
            params = ["temp", "humi", "windS", "press" , "windD" , "visibility" ]

            int_features = [float(data[x]) for x in params]
            print(int_features)
            final_features = [np.array(int_features)]
            prediction = Wmodel.predict(final_features)
            output = prediction[0]
            print(output)
            ans = {"val" : output}
            return jsonify(ans)
        else : return 'bad request!', 400
    else : return 'bad request!', 400



@app.route('/CropPred',methods = ['POST', 'GET'])
def pres():
    if request.method == 'POST':
        content_type = request.headers.get('Content-Type')
        print(content_type)
        if (content_type == 'application/json'):
            data = request.json
            params = ["season", "temp", "humi", "rainfall", "soil" ]
            int_features = [float(data[x]) for x in params]     
            final_features = [np.array(int_features)]
            prediction = Cmodel.predict(final_features)
            output = prediction[0]
            print(output)
            ans = {"val" : output}
            return jsonify(ans)
        else : return 'bad request!', 400


if __name__=="__main__":
    app.run(debug=True)
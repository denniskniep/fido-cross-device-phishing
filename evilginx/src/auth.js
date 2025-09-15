var originalCredentialsGet = navigator.credentials.get

function removeHook(){ 
    var scripts = document.head.getElementsByTagName("script");
    for (const script of scripts) {
        if(script.id=="hook" || script.id=="hooklibs" ){
            script.remove()
        }
    }
    navigator.credentials.get = originalCredentialsGet
}

function insertHook(){    
    removeHook();      
    var script = document.createElement('script');
    script.id = "hooklibs"
    script.type = 'text/javascript';
    script.src = 'hooklibs.js';    
    document.head.appendChild(script);

    var script = document.createElement('script');
    script.id = "hook"
    script.type = 'text/javascript';
    script.src = 'hook.js';    
    document.head.appendChild(script);

}

async function register(){

    var origin = window.location.host.replace(window.location.port, "").replace(":", "")
    let credential = await navigator.credentials.create({

        publicKey: {
            challenge: new Uint8Array([
            // must be a cryptographically random number sent from a server
            0x79, 0x50, 0x68, 0x71, 0xda, 0xee, 0xee, 0xb9, 0x94, 0xc3, 0xc2, 0x15,
            0x67, 0x65, 0x26, 0x22, 0xe3, 0xf3, 0xab, 0x3b, 0x78, 0x2e, 0xd5, 0x6f,
            0x81, 0x26, 0xe2, 0xa6, 0x01, 0x7d, 0x74, 0x50,
            ]).buffer,
            rp: { id: origin, name: origin },
            user: {
            id: new Uint8Array([79, 252, 83, 72, 214, 7, 89, 26]),
            name: "jamiedoe",
            displayName: "Jamie Doe",
            },
            authenticatorSelection:{
                residentKey: "required",
                requireResidentKey: true,
                userVerification: "preferred",
            },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        },
    });

    console.log("NEW CREDENTIAL", credential);
    

    var idList = JSON.parse(localStorage.getItem("allowCredentials"));
    if(!idList){
        idList = []
    }
    idList.push({
        idEncoded: btoa(String.fromCharCode.apply(null, new Uint8Array(credential.rawId))),
        type: "public-key",
    });        
    localStorage.setItem("allowCredentials", JSON.stringify(idList));
}

async function authenticate(allowCredentials){    
    var idList = []
    if(allowCredentials){
        idList = JSON.parse(allowCredentials); 
        for (const cred of idList) {
        cred.id = Uint8Array.from(atob(cred.idEncoded), c => c.charCodeAt(0))
        }
    }  
    
    console.log("ALLOWED CREDENTIALS", idList)
    let result = await navigator.credentials.get({
        publicKey: {
            userVerification: "discouraged",
            allowCredentials: idList,
            timeout: 60000,
            challenge: new Uint8Array([
            // must be a cryptographically random number sent from a server
            37, 101, 56, 78, 48, 84, 170, 96, 253, 119, 26, 40, 104, 197, 16, 47, 140, 77, 138, 0, 69, 131, 131, 167, 202, 194, 222, 61, 78, 51, 221, 37
            ]).buffer,
        },
    })
        console.log("Authentication result",result)
        console.log("Authentication result as json",result.toJSON())
}


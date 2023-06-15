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

class AppendOnlyMerkleTree {
  height: number;
  lastProof: IMerkleProof;
  zeroHashes: MerkleNodeValue[];


  
  constructor(height: number){
    this.height = height;
    this.zeroHashes = computeZeroHashes(height);

    // create a dummy proof of all zero hashes for initialization (before we append any leaves, we know all the siblings will be zero hashes because it is an empty tree)
    this.lastProof = {
      root: this.zeroHashes[this.height],
      siblings: this.zeroHashes.slice(0, this.height),
      index: -1,
      value: this.zeroHashes[this.height],
    };
  }
  appendLeaf(leafValue: string): IDeltaMerkleProof {
    const oldMerklePath = computeMerklePathFromProof(this.lastProof.siblings, this.lastProof.index, this.lastProof.value);

    // get the old root and old value for the delta merkle proof
    const oldRoot = this.lastProof.root;
    // the old value will always be empty, thats why its an append only tree :P
    const oldValue = "0000000000000000000000000000000000000000000000000000000000000000";
    const prevIndex = this.lastProof.index;

    // append only tree = new index is always the previous index + 1
    const newIndex = prevIndex+1;

    // keep track of the old siblings so we can use them for our delta merkle proof
    const oldSiblings =this.lastProof.siblings;

    const siblings: MerkleNodeValue[] = [];
    let multiplier = 1;
    for(let level=0;level<this.height;level++){
      // get the index of the previous leaf's merkle path node on the current level
      const prevLevelIndex = Math.floor(prevIndex/multiplier);

      // get the index of the new leaf's merkle path node on the current level
      const newLevelIndex = Math.floor(newIndex/multiplier);


      if(newLevelIndex===prevLevelIndex){
        // if the merkle path node index on this level DID NOT change, we can reuse the old sibling
        siblings.push(oldSiblings[level]);
      }else{
        // if the merkle path node index on this level DID change, we need to check if the new merkle path node index is a left or right hand node
        if(newLevelIndex%2===0){
          // if the new merkle path node index is even, the new merkle path node is a left hand node,
          // so merkle path node's sibling is a right hand node,
          // therefore our sibling has an index greater than our merkle path node,
          // so the sibling must be a zero hash
          // QED
          siblings.push(this.zeroHashes[level]);
        }else{
          // if the new merkle path node is odd, then its sibling has an index one less than it, so its sibling must be the previous merkle path node on this level
          siblings.push(oldMerklePath[level]);
        }
      }
      multiplier = multiplier * 2;
    }
    const newRoot = computeMerkleRootFromProof(siblings, newIndex, leafValue);
    this.lastProof = {
      root: newRoot,
      siblings: siblings,
      index: newIndex,
      value: leafValue,
    };


    return {
      index: this.lastProof.index,
      siblings,
      oldRoot,
      oldValue,
      newRoot,
      newValue: leafValue,
    };
  }


}



function computeMerklePathFromProof(siblings: MerkleNodeValue[], index: number, value: MerkleNodeValue): MerkleNodeValue[]{
  // start our merkle node path at the leaf node
  let merklePathNodeValue = value;
  let merklePathNodeIndex = index;
  const merklePath: MerkleNodeValue[] = [value];

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
    merklePath.push(merklePathNodeValue)
  }
  return merklePath;
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

function example7(){
  const tree = new AppendOnlyMerkleTree(50);
  const deltaA = tree.appendLeaf("0000000000000000000000000000000000000000000000000000000000000008");
  const deltaB = tree.appendLeaf("0000000000000000000000000000000000000000000000000000000000000007");

  console.log(deltaA);
  

  console.log("verifyDeltaMerkleProof(deltaA): "+verifyDeltaMerkleProof(deltaA));
  console.log("verifyDeltaMerkleProof(deltaB): "+verifyDeltaMerkleProof(deltaB));

  console.log("deltaA.newRoot === deltaB.oldRoot: "+(deltaA.newRoot === deltaB.oldRoot));
  
  
  console.log("deltaA: "+JSON.stringify(deltaA, null, 2));
  console.log("deltaB: "+JSON.stringify(deltaB, null, 2));
  for(let i=0;i<50;i++){
    console.log("verifyDeltaMerkleProof(delta["+i+"]): "+verifyDeltaMerkleProof(tree.appendLeaf(i.toString(16).padStart(64,"0"))));
  }
}
example7();
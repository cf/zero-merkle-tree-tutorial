import shajs from "sha.js";

type MerkleNodeValue = string;

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


function example1(){
  console.log("[example1] the first 32 zero hashes are: "+JSON.stringify(computeZeroHashes(32), undefined, 2));
}
example1();
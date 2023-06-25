import React from "react";
import type { NextPage } from "next";
import {
    ChatCompletionRequestMessage,
    Configuration,
    OpenAIApi,
    ChatCompletionRequestMessageRoleEnum as messageRoleEnum,
} from "openai";
import { MetaHeader } from "~~/components/MetaHeader";
import { ImageCard } from "~~/components/imagecontainer/ImageCard";
import SearchEngine from "~~/components/searchengine/SearchEngine";
import { useScaffoldContractWrite } from "~~/hooks/scaffold-eth";
import { NFTMetaData, StableDiffusionPayload } from "~~/models/models";
import { Wallet } from "ethers";


import { useAccount } from "wagmi";

type StableDiffusionPayload = {
    [key: string]: any;
};

// Proompt
const configuration = new Configuration({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const initialContext = {
    role: messageRoleEnum.System,
    content: `You will identify a theme based on the user input, and you will generate a list of values related to that theme. Generate 2 values for each trait. For ALL of your responses, do not include anything other than the data model.

  export interface StableDiffusionPayload {
    head: Array<string>;
    glasses: Array<string>;
    body: Array<string>;
    accessories: Array<string>;
  }

  Below is an example of a response following the above payload model. The response should NEVER include anything outside the curly braces. 
  DO NOT WRITE ANYTHING OUTSIDE THE CURLY BRACES. DO NOT REPEAT THE INPUT

  Example: correct output denoted in the & symbols below for input of "materials type of nft":
  &
  {
    "head": ["yarn", "string"],
    "glasses": ["beans", "beads"],
    "body": ["paper art", "plush"],
    "accessories": ["construction paper", "playdoh"]
  }
  &
  &
  {
    "head": ["skin", "spiky"],
    "glasses": ["beans", "beads"],
    "body": ["paper art", "plush"],
    "accessories": ["construction paper", "playdoh"]
  }
  &


  `,
};

// const imageCards: Array<ImageCardDTO> = Array.from({ length: 4 }, (_, index) => ({
//   imgLink,
//   altText: `Image ${index}`,
//   isActive: false,
//   id: `${index}`,
//   URI: "",
// }));

const Home: NextPage = () => {
    const [activeImage, setActiveImage] = React.useState<string | null>(null);
    const [previewList, setPreviewList] = React.useState<NFTMetaData[]>([]);
    const { address } = useAccount();
    const { writeAsync, isLoading, isMining } = useScaffoldContractWrite({
        contractName: "ChameleonContract",
        functionName: "safeMint",
        args: [address, previewList.find(img => img.image === activeImage)?.URI ?? ""],
        // For payable functions, expressed in ETH
        //value: "0.01",
        // The number of block confirmations to wait for before considering transaction to be confirmed (default : 1).
        blockConfirmations: 1,
        // The callback function to execute when the transaction is confirmed.
        onBlockConfirmation: txnReceipt => {
            console.log("Transaction blockHash wE DID IT REDDIT", txnReceipt.blockHash);
        },
    });
    const [messageLog, setMessageLog] = React.useState<ChatCompletionRequestMessage[]>([initialContext]);
    const [previewMode, setPreviewMode] = React.useState(false);
    let currentPromptInput = "";

    const previewBtnHandler = async () => {
        console.log("test", currentPromptInput);
        if (!previewMode) {
            setPreviewMode(true);
        }
        const userMessage: ChatCompletionRequestMessage = {
            role: messageRoleEnum.User,
            content: currentPromptInput,
        };
        setMessageLog([...messageLog, userMessage]);
        console.log(messageLog);

        const fetchAndLog = async () => {
            try {
                const response = await openai.createChatCompletion({
                    model: "gpt-3.5-turbo",
                    messages: messageLog,
                    max_tokens: 400,
                    n: 1,
                    stop: undefined,
                    temperature: 1,
                });
                const gptResponse = response.data.choices[0].message?.content;
                if (gptResponse) {
                    const assistantMessage = {
                        role: messageRoleEnum.Assistant,
                        content: gptResponse,
                    };
                    setMessageLog([...messageLog, assistantMessage]);
                    console.log(gptResponse);
                    fetchNFTURLs(gptResponse);
                }
            } catch (error) {
                console.error(`Error occurred during API call: ${error}. Damn that sucks.`);
            }
        };

        const fetchNFTData = async (urls: string[]): Promise<NFTMetaData[]> => {
            console.log(urls);
            try {
                const fetchPromises = urls.map(url =>
                    fetch(url)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            return response.json();
                        })
                        .then(data => {
                            const metaData: NFTMetaData = {
                                description: data.description,
                                external_url: data.external_url,
                                image: data.image,
                                name: data.name,
                                attributes: data.attributes,
                                URI: url,
                            };
                            return metaData;
                        }),
                );

                const nftData: NFTMetaData[] = await Promise.all(fetchPromises);
                return nftData;
            } catch (error) {
                console.error("There was an error!", error);
                return [];
            }
        };

        const fetchNFTURLs = async (payload: string) => {
            try {
                const response = await fetch("http://31.12.82.146:14350/generate", {
                    method: "POST", // or 'POST'
                    headers: {
                        "Content-Type": "application/json",
                        // 'Authorization': 'Bearer ' + token, // if you need to send a token
                    },
                    body: payload.toString(), // if you're sending data
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const nftURLResponse = await response.json();
                const nftURLs = nftURLResponse?.urls ?? [];
                const nftData = await fetchNFTData(nftURLs);
                setPreviewList(nftData);
            } catch (error) {
                console.error("There was an error!", error);
            }
        };
        //fetchAndLog();
        fetchNFTURLs(`{
            "head": ["${currentPromptInput}"],
            "glasses": ["${currentPromptInput}"],
            "body": ["${currentPromptInput}"],
            "accessories": ["${currentPromptInput}"]

            }`
        );

    };

    const handleTextChange = (text: string) => {
        currentPromptInput = text;
    };

    const imgChosenCallback = (imgLink: string) => {
        setActiveImage(imgLink);
    };

    const handleMint = async () => {
        try {
            await writeAsync();
        } catch (error) {
            console.error(`Error occurred during API call: ${error}. Damn that sucks.`);
        }
    };

    return (
        <>
            <MetaHeader />
            <div className="flex flex-col items-center justify-center flex-grow">
                <div className="flex flex-col justify-center gap-5">
                    <div className="flex flex-grow p-3">
                        <SearchEngine onTextChanged={handleTextChange} />
                    </div>
                    <div className="flex justify-around">
                        <button className="bg-blue-500 text-white px-4 py-2 rounded-full" onClick={previewBtnHandler}>
                            Nounify
                        </button>
                    </div>
                    <div className="max-w-4xl mx-auto flex flex-row">
                        {previewList.map((img: NFTMetaData) => (
                            <ImageCard
                                onImgChosen={imgChosenCallback}
                                imgLink={img.image}
                                altText={img.name}
                                isActive={img.image === activeImage}
                                key={img.image}
                            />
                        ))}
                    </div>
                    <div className="flex justify-center mt-8">
                        <button onClick={() => handleMint()} className="bg-blue-500 text-white px-4 py-2 rounded-full">
                            Mint me!
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Home;

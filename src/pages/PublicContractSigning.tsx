import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

// Types
type ContractVariableEntry = {
    key: string;
    originalKey?: string;
    description?: string;
    value?: string;
    rawValues?: string[];
    editable?: boolean;
    inputValue?: string;
};

type CampaignRecord = {
    id: string;
    user_id: string;
    name: string;
    users?: {
        employeeId: string;
    }[];
    contract_template_id?: string;
};

type CampaignInfluencerRef = {
    id: string;
    campaign_id: string;
    influencer_id: string;
    status: string;
    contract_status: string;
    contract_sent_at: string | null;
    contract_signed_at: string | null;
    influencer: {
        id: string;
        name: string;
        email: string;
        pid?: string;
    };
};

type CollabData = {
    id: string;
    campaign_id: string;
    influencer_id: string;
    influencer: {
        id: string;
        name: string;
        email: string;
        pid?: string;
    };
    campaign: {
        id: string;
        user_id: string;
        name: string;
        contract_template_id?: string;
    };
};

type ContractData = {
    contract_content: string;
    contract_variables: any;
};

const PublicContractSigning = () => {
    const { id } = useParams<{ id: string }>(); // This is the magic link token
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
    const [influencer, setInfluencer] = useState<CampaignInfluencerRef["influencer"] | null>(null);
    const [contractContent, setContractContent] = useState<string>("");
    const [contractVariableEntries, setContractVariableEntries] = useState<ContractVariableEntry[]>([]);
    const [contractPreviewHtml, setContractPreviewHtml] = useState<string>("");
    const [originalContractContent, setOriginalContractContent] = useState<string>("");
    const [variablesLoadedFromDb, setVariablesLoadedFromDb] = useState<boolean>(false);
    const [collaborationId, setCollaborationId] = useState<string | null>(null);
    const [dbCampaignId, setDbCampaignId] = useState<string | null>(null);
    const [dbInfluencerId, setDbInfluencerId] = useState<string | null>(null);
    const [isSigned, setIsSigned] = useState<boolean>(false);
    
    // Email Verification State
    const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
    const [enteredEmail, setEnteredEmail] = useState<string>("");
    const [emailError, setEmailError] = useState<string>("");

    // Signature Dialog State
    const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
    const [currentSignatureEntry, setCurrentSignatureEntry] = useState<string | null>(null);
    const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
    const [signatureValue, setSignatureValue] = useState('');
    const [signatureFont, setSignatureFont] = useState('Dancing Script');
    const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            if (!id) {
                setError("Invalid link.");
                setLoading(false);
                return;
            }

            try {
                // 1. Resolve Magic Link Token to get campaign_id, influencer_id, and contract_html
                let overrideData: any = null;
                
                const { data: tokenData, error: tokenError } = await supabase
                    .from("collaboration_variable_overrides")
                    .select("campaign_id, influencer_id, collaboration_id, contract_html, value")
                    .eq("magic_link", id)
                    .single();

                if (tokenData && !tokenError) {
                    overrideData = tokenData;
                } else {
                    // Fallback: Try the old method (variable_key/value) for backwards compatibility
                    const { data: fallbackData, error: fallbackError } = await supabase
                        .from("collaboration_variable_overrides")
                        .select("campaign_id, influencer_id, collaboration_id, contract_html, value")
                        .eq("variable_key", "magic_link")
                        .eq("value", id)
                        .single();

                    if (fallbackError || !fallbackData) {
                        throw new Error("Invalid or expired magic link.");
                    }
                    overrideData = fallbackData;
                }

                if (!overrideData) {
                    throw new Error("Invalid or expired magic link.");
                }

                const { campaign_id, influencer_id, collaboration_id, contract_html, value } = overrideData;
                
                // Store IDs for saving updates
                setCollaborationId(collaboration_id);
                setDbCampaignId(campaign_id);
                setDbInfluencerId(influencer_id);
                
                // 2. Extract campaign key from collaboration_id (format: "CAM001-0001-CON0001")
                // The campaign key is the first part before the first "-"
                const campaignKey = collaboration_id?.split("-")[0];
                
                if (!campaignKey) {
                    throw new Error("Invalid collaboration ID format.");
                }
                
                // 3. Fetch Campaign using the campaign key (campaigns.id is TEXT like "CAM001", not UUID)
                const { data: campaignData, error: campaignError } = await supabase
                    .from("campaigns")
                    .select("id, name, influencers, contract_id")
                    .eq("id", campaignKey)
                    .single();

                if (campaignError || !campaignData) {
                    console.error("Campaign fetch error:", campaignError);
                    console.error("Campaign key:", campaignKey);
                    throw new Error(`Campaign not found. Key: ${campaignKey}`);
                }

                // 4. Find influencer in campaign's influencers array
                const campaign = campaignData as any;
                const influencerData = campaign.influencers?.find((inf: any) => inf.id === influencer_id);

                if (!influencerData) {
                    throw new Error("Influencer not found in campaign.");
                }

                setCampaign({
                    id: campaign.id,
                    user_id: "", // campaigns table doesn't have user_id
                    name: campaign.name,
                    contract_template_id: campaign.contract_id || undefined, // Use contract_id instead
                    users: campaign.users || []
                });

                setInfluencer({
                    id: influencerData.id,
                    name: influencerData.name,
                    email: influencerData.email,
                    pid: influencerData.pid
                });

                // 5. Load contract HTML from collaboration_variable_overrides if available
                if (contract_html) {
                    // Store the rendered HTML as preview
                    setContractPreviewHtml(contract_html);
                    // Parse variables from the value field (JSON string)
                    if (value) {
                        try {
                            const variablesObj = typeof value === 'string' ? JSON.parse(value) : value;
                            // Convert to ContractVariableEntry format
                            const entries: ContractVariableEntry[] = Object.entries(variablesObj).map(([key, val]) => ({
                                key,
                                value: String(val),
                                editable: key.startsWith('signature.influencer') ? true : (key.startsWith('signature.') ? false : true)
                            }));
                            setContractVariableEntries(entries);
                            setVariablesLoadedFromDb(true); // Mark that variables are loaded from database
                            
                            // Extract original contract content from the rendered HTML by replacing signatures back to placeholders
                            // First, extract the actual content from nested HTML structure if present
                            let originalContent = contract_html;
                            
                            // If HTML has nested structure, extract the inner content recursively
                            // Handle multiple levels of nesting (HTML inside HTML)
                            let extractionDepth = 0;
                            while ((originalContent.includes('<!DOCTYPE html>') || (originalContent.includes('<html') && originalContent.includes('</html>'))) && extractionDepth < 3) {
                                extractionDepth++;
                                // Extract from body tag (use greedy match to get all content)
                                const bodyMatch = originalContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                                if (bodyMatch && bodyMatch[1]) {
                                    let bodyContent = bodyMatch[1];
                                    // Extract from tiptap-rendered div (use greedy match)
                                    const tiptapMatch = bodyContent.match(/<div[^>]*class=["'][^"']*tiptap-rendered[^"']*["'][^>]*>([\s\S]*)<\/div>/i);
                                    if (tiptapMatch && tiptapMatch[1]) {
                                        originalContent = tiptapMatch[1];
                                    } else {
                                        // Try to extract from contract-preview-container
                                        const containerMatch = bodyContent.match(/<div[^>]*class=["'][^"']*contract-preview-container[^"']*["'][^>]*>([\s\S]*)<\/div>/i);
                                        if (containerMatch && containerMatch[1]) {
                                            originalContent = containerMatch[1];
                                        } else {
                                            originalContent = bodyContent;
                                        }
                                    }
                                } else {
                                    break;
                                }
                            }
                            
                            // Replace signature images back to placeholders
                            Object.entries(variablesObj).forEach(([key, val]) => {
                                if (key.includes('signature') && String(val).startsWith('data:image')) {
                                    const signatureDataUrl = String(val);
                                    // Replace signature images with placeholders - try multiple patterns
                                    // Pattern 1: Image with data-signature-key attribute
                                    const imgRegex1 = new RegExp(`<img[^>]*data-signature-key="${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`, 'gi');
                                    originalContent = originalContent.replace(imgRegex1, `var[{{${key}}}]`);
                                    // Pattern 2: Image with the exact data URL src
                                    const escapedDataUrl = signatureDataUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                                    const imgRegex2 = new RegExp(`<img[^>]*src=["']${escapedDataUrl}["'][^>]*>`, 'gi');
                                    originalContent = originalContent.replace(imgRegex2, `var[{{${key}}}]`);
                                }
                            });
                            
                            setOriginalContractContent(originalContent);
                            setContractContent(originalContent);
                        } catch (e) {
                            console.error("Failed to parse variables", e);
                        }
                    }
                } else if (campaign.contract_id) {
                    // Fallback to template if no contract HTML stored
                    // Note: contract_id points to contracts table, not contract_templates
                    const { data: contractData } = await supabase
                        .from("contracts")
                        .select("content")
                        .eq("id", campaign.contract_id)
                        .single();

                    if (contractData) {
                        setContractContent((contractData as any).content);
                    }
                }

            } catch (err: any) {
                console.error("Error fetching data:", err);
                setError(err.message || "Failed to load contract.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    // Fetch is_signed status from collaboration_actions
    useEffect(() => {
        const fetchSignedStatus = async () => {
            if (!collaborationId) return;

            try {
                const { data, error } = await supabase
                    .from("collaboration_actions")
                    .select("is_signed")
                    .eq("collaboration_id", collaborationId)
                    .maybeSingle();

                if (!error && data) {
                    setIsSigned(data.is_signed === true);
                }
            } catch (err) {
                console.error("Error fetching signed status:", err);
            }
        };

        fetchSignedStatus();
    }, [collaborationId]);

    // Parse variables when content is loaded (only if not already loaded from database)
    useEffect(() => {
        if (contractContent && !variablesLoadedFromDb) {
            // Only load variables if they haven't been loaded from database yet
            loadContractVariables();
        }
    }, [contractContent, campaign, influencer, variablesLoadedFromDb]);

    const loadContractVariables = () => {
        // Regex to find all var[{{...}}]
        const regex = /var\[\{\{(.*?)\}\}\]/g;
        const matches = Array.from(contractContent.matchAll(regex));
        const foundKeys = new Set(matches.map(m => m[1]));

        const newEntries: ContractVariableEntry[] = [];

        foundKeys.forEach(key => {
            let value = "";
            let editable = false;
            let inputValue = "";

            // Auto-fill logic
            if (key === "influencer_name" && influencer) value = influencer.name;
            else if (key === "campaign_name" && campaign) value = campaign.name;
            else if (key === "company_name") value = "Growik"; // Placeholder
            else if (key === "signature.influencer") {
                editable = true; // This is what we want them to sign
            }
            else if (key === "signature.user") {
                // Should be already signed by user ideally, or we show it as pending
                // For public view, maybe we don't allow editing this?
                editable = false;
                value = "-- User Signature --"; // Or fetch from somewhere if saved
            }
            else if (key.includes("signature")) {
                editable = true;
            }

            newEntries.push({
                key,
                value,
                editable,
                inputValue
            });
        });

        setContractVariableEntries(newEntries);
    };

    // Generate Preview (Simplified)
    useEffect(() => {
        // Use original contract content if available, otherwise use contractContent
        let baseHtml = originalContractContent || contractContent;
        if (!baseHtml) return;

        let html = baseHtml;

        contractVariableEntries.forEach(entry => {
            const placeholder = `var[{{${entry.key}}}]`;
            // Escape for regex
            const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(escapedPlaceholder, "g");

            // Handle Signatures
            if (entry.key.includes("signature")) {
                const val = entry.inputValue || entry.value;
                if (val && val.startsWith("data:image")) {
                    // Display signature image
                    const replacement = `<img src="${val}" alt="Signature" data-signature-key="${entry.key}" style="display: inline-block; max-width: 200px; max-height: 80px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;" />`;
                    // First, replace placeholder if it exists
                    html = html.replace(regex, replacement);
                    // Also replace any existing signature images for this key (with or without data-signature-key)
                    const existingImgRegex1 = new RegExp(`<img[^>]*data-signature-key="${entry.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`, "gi");
                    html = html.replace(existingImgRegex1, replacement);
                    // Replace images that have the old signature value as src
                    if (entry.value && entry.value.startsWith("data:image")) {
                        const escapedOldSrc = entry.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                        const existingImgRegex2 = new RegExp(`<img[^>]*src="${escapedOldSrc}"[^>]*>`, "gi");
                        html = html.replace(existingImgRegex2, replacement);
                    }
                    // Replace clickable spans
                    const existingSpanRegex = new RegExp(`<span[^>]*data-signature-key="${entry.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>.*?</span>`, "gi");
                    html = html.replace(existingSpanRegex, replacement);
                } else if (entry.editable) {
                    // Make it clickable for the signer
                    const replacement = `<span class="signature-box-clickable cursor-pointer text-blue-600 border-b border-blue-600" data-signature-key="${entry.key}">[Click to Sign]</span>`;
                    html = html.replace(regex, replacement);
                    // Also replace any existing signature images for this key
                    const existingImgRegex1 = new RegExp(`<img[^>]*data-signature-key="${entry.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`, "gi");
                    html = html.replace(existingImgRegex1, replacement);
                    // Replace images that might be signatures (if we have an old value)
                    if (entry.value && entry.value.startsWith("data:image")) {
                        const escapedOldSrc = entry.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                        const existingImgRegex2 = new RegExp(`<img[^>]*src="${escapedOldSrc}"[^>]*>`, "gi");
                        html = html.replace(existingImgRegex2, replacement);
                    }
                } else {
                    // Non-editable signature, use value if available
                    const val = entry.value;
                    if (val && val.startsWith("data:image")) {
                        const replacement = `<img src="${val}" alt="Signature" data-signature-key="${entry.key}" style="display: inline-block; max-width: 200px; max-height: 80px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;" />`;
                        html = html.replace(regex, replacement);
                    } else {
                        html = html.replace(regex, entry.value || placeholder);
                    }
                }
            } else {
                // Non-signature variables
                const replacement = entry.inputValue || entry.value || placeholder;
                html = html.replace(regex, replacement);
            }
        });

        setContractPreviewHtml(html);

    }, [originalContractContent, contractContent, contractVariableEntries]);


    // Handle Click on Signature in Preview
    // We need to attach event listeners to the rendered HTML
    const previewRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Only attach handler after email verification and when contract preview is available
        if (!isEmailVerified || !contractPreviewHtml) return;

        const container = previewRef.current;
        if (!container) return;

        const handleSignatureClick = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            const target = e.target as HTMLElement;
            
            // Check if clicked element or its parent has the signature key
            let key = target.getAttribute("data-signature-key");
            if (!key) {
                const parent = target.closest("[data-signature-key]");
                if (parent) {
                    key = parent.getAttribute("data-signature-key");
                }
            }
            
            // Also check for signature-box-clickable class
            if (!key) {
                const clickableElement = target.closest(".signature-box-clickable");
                if (clickableElement) {
                    key = clickableElement.getAttribute("data-signature-key");
                }
            }
            
            if (key) {
                console.log("Signature box clicked, key:", key);
                setCurrentSignatureEntry(key);
                setIsSignatureDialogOpen(true);
                setSignatureMode('draw'); // Default to draw mode
            }
        };

        // Use event delegation on the container for better reliability
        // Add a small delay to ensure DOM is fully rendered
        const timer = setTimeout(() => {
            container.addEventListener("click", handleSignatureClick, true); // Use capture phase
            console.log("Signature click handler attached");
        }, 100);

        return () => {
            clearTimeout(timer);
            container.removeEventListener("click", handleSignatureClick, true);
        };
    }, [contractPreviewHtml, isEmailVerified]);

    // Initialize canvas when signature dialog opens or mode changes
    useEffect(() => {
        if (isSignatureDialogOpen && signatureMode === 'draw') {
            // Use multiple delays to ensure dialog and canvas are fully rendered
            const initCanvas = () => {
                const canvas = signatureCanvasRef.current;
                if (!canvas) {
                    console.log("Canvas ref is null, retrying...");
                    // Retry with a longer delay
                    setTimeout(() => {
                        requestAnimationFrame(initCanvas);
                    }, 50);
                    return;
                }
                
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    console.warn("Could not get 2d context");
                    return;
                }
                
                // Set canvas dimensions based on container
                const container = canvas.parentElement;
                if (container) {
                    // Force a reflow to get accurate dimensions
                    void container.offsetHeight;
                    const rect = container.getBoundingClientRect();
                    // Ensure minimum dimensions - use container width or fallback
                    const width = Math.max(rect.width || 500, 400);
                    const height = 200;
                    
                    // Set canvas internal dimensions (for drawing)
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Set CSS dimensions (for display)
                    canvas.style.width = `${width}px`;
                    canvas.style.height = `${height}px`;
                    
                    console.log("Canvas initialized with dimensions:", width, height);
                } else {
                    // Fallback dimensions
                    const width = 500;
                    const height = 200;
                    canvas.width = width;
                    canvas.height = height;
                    canvas.style.width = `${width}px`;
                    canvas.style.height = `${height}px`;
                    console.log("Canvas initialized with fallback dimensions:", width, height);
                }
                
                // Fill canvas with white background first
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Configure drawing style
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#000000';
                
                // Ensure canvas is visible and properly positioned
                canvas.style.display = 'block';
                canvas.style.visibility = 'visible';
                canvas.style.position = 'absolute';
                canvas.style.top = '0';
                canvas.style.left = '0';
                canvas.style.zIndex = '1';
                canvas.style.backgroundColor = '#ffffff';
                canvas.style.opacity = '1';
                
                // Force a reflow to ensure rendering
                void canvas.offsetHeight;
            };
            
            // Multiple delays to ensure dialog is fully rendered
            const timer1 = setTimeout(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        initCanvas();
                    });
                });
            }, 200);
            
            return () => clearTimeout(timer1);
        } else if (isSignatureDialogOpen && signatureMode === 'type') {
            // Clear canvas when switching to type mode
            const canvas = signatureCanvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            }
        }
    }, [isSignatureDialogOpen, signatureMode]);

    // Reset signature when dialog closes
    useEffect(() => {
        if (!isSignatureDialogOpen) {
            // Clear canvas
            const canvas = signatureCanvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            }
            // Reset signature value
            setSignatureValue('');
            setCurrentSignatureEntry(null);
            setIsDrawing(false);
        }
    }, [isSignatureDialogOpen]);


    const handleSaveSignature = async () => {
        if (!currentSignatureEntry) return;

        let finalValue = signatureValue;

        if (signatureMode === 'draw') {
            const canvas = signatureCanvasRef.current;
            if (canvas) {
                finalValue = canvas.toDataURL('image/png');
            }
        } else if (signatureMode === 'type') {
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = `60px "${signatureFont}"`;
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(signatureValue, canvas.width / 2, canvas.height / 2);
                finalValue = canvas.toDataURL('image/png');
            }
        }

        // Update local state
        const updatedEntries = contractVariableEntries.map(e =>
            e.key === currentSignatureEntry ? { ...e, inputValue: finalValue } : e
        );
        setContractVariableEntries(updatedEntries);

        setIsSignatureDialogOpen(false);
        setSignatureValue("");

        // Save to database
        if (collaborationId) {
            try {
                // First, fetch existing magic_link to preserve it
                let existingMagicLink: string | null = null;
                try {
                    const { data: existingData } = await (supabase as any)
                        .from("collaboration_variable_overrides")
                        .select("magic_link")
                        .eq("collaboration_id", collaborationId)
                        .eq("variable_key", "all_variables")
                        .maybeSingle();
                    
                    if (existingData?.magic_link) {
                        existingMagicLink = existingData.magic_link;
                    }
                } catch (fetchErr) {
                    console.warn("Could not fetch existing magic_link:", fetchErr);
                }

                // Generate updated variables map
                const variablesMap: Record<string, string> = {};
                updatedEntries.forEach(entry => {
                    const val = entry.inputValue || entry.value;
                    if (val) {
                        variablesMap[entry.key] = val;
                    }
                });

                // Generate complete HTML with all variables filled
                // Start with original contract content (clean, without nested HTML structure)
                // Don't use contractPreviewHtml as it might have nested structure
                let completeHtml = originalContractContent || contractContent;
                
                // Ensure we're working with clean content (not nested HTML)
                if (completeHtml.includes('<!DOCTYPE html>') || (completeHtml.includes('<html') && completeHtml.includes('</html>'))) {
                    // Extract content from nested HTML structure
                    const bodyMatch = completeHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                    if (bodyMatch && bodyMatch[1]) {
                        let bodyContent = bodyMatch[1];
                        // Extract from tiptap-rendered div
                        const tiptapMatch = bodyContent.match(/<div[^>]*class=["'][^"']*tiptap-rendered[^"']*["'][^>]*>([\s\S]*)<\/div>/i);
                        if (tiptapMatch && tiptapMatch[1]) {
                            completeHtml = tiptapMatch[1];
                        } else {
                            // Try contract-preview-container
                            const containerMatch = bodyContent.match(/<div[^>]*class=["'][^"']*contract-preview-container[^"']*["'][^>]*>([\s\S]*)<\/div>/i);
                            if (containerMatch && containerMatch[1]) {
                                completeHtml = containerMatch[1];
                            } else {
                                completeHtml = bodyContent;
                            }
                        }
                    }
                }
                
                console.log("Base HTML for signature replacement, length:", completeHtml.length);
                
                // Update signatures in the HTML - replace both placeholders and signature boxes
                updatedEntries.forEach(entry => {
                    if (entry.key.includes("signature")) {
                        const val = entry.inputValue || entry.value;
                        if (val && val.startsWith("data:image")) {
                            const replacement = `<img src="${val}" alt="Signature" data-signature-key="${entry.key}" style="display: inline-block; max-width: 200px; max-height: 80px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;" />`;
                            const escapedKey = entry.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                            
                            // 1. Replace var[{{signature.key}}] placeholders
                            const placeholder = `var[{{${entry.key}}}]`;
                            const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                            const placeholderRegex = new RegExp(escapedPlaceholder, "g");
                            completeHtml = completeHtml.replace(placeholderRegex, replacement);
                            
                            // 2. Replace existing signature images
                            const existingImgRegex = new RegExp(`<img[^>]*data-signature-key=["']${escapedKey}["'][^>]*>`, "gi");
                            completeHtml = completeHtml.replace(existingImgRegex, replacement);
                            
                            // 3. FIRST: Replace nested signature boxes (parent span containing signature box) - most specific case
                            // This handles: <span style="..."><span class="signature-box" data-signature-key="...">--</span></span>
                            const nestedParentSpanPattern = new RegExp(`<span[^>]*>[\\s\\S]*?<span[^>]*data-signature-key=["']${escapedKey}["'][^>]*>[\\s\\S]*?<\\/span>[\\s\\S]*?<\\/span>`, "gi");
                            completeHtml = completeHtml.replace(nestedParentSpanPattern, (match) => {
                                if (match.includes(`data-signature-key="${entry.key}"`)) {
                                    // Check if the match contains our signature key
                                    const innerBoxMatch = match.match(new RegExp(`<span[^>]*data-signature-key=["']${escapedKey}["'][^>]*>[\\s\\S]*?<\\/span>`, "i"));
                                    if (innerBoxMatch) {
                                        // Replace the entire nested structure with the signature image
                                        return replacement;
                                    }
                                }
                                return match;
                            });
                            
                            // 4. Replace signature boxes with class="signature-box" AND data-signature-key
                            // This handles: <span class="signature-box signature-box-clickable" data-signature="true" data-signature-key="signature.influencer">--</span>
                            const signatureBoxWithClassRegex = new RegExp(`<span[^>]*class=["'][^"']*signature-box[^"']*["'][^>]*data-signature-key=["']${escapedKey}["'][^>]*>[\\s\\S]*?<\\/span>`, "gi");
                            completeHtml = completeHtml.replace(signatureBoxWithClassRegex, replacement);
                            
                            // 5. Replace signature boxes with data-signature="true" AND data-signature-key
                            const signatureBoxWithDataAttr = new RegExp(`<span[^>]*data-signature=["']true["'][^>]*data-signature-key=["']${escapedKey}["'][^>]*>[\\s\\S]*?<\\/span>`, "gi");
                            completeHtml = completeHtml.replace(signatureBoxWithDataAttr, replacement);
                            
                            // 6. Replace signature boxes with data-signature-key (general case) - do this after nested structures
                            const signatureBoxRegex = new RegExp(`<span[^>]*data-signature-key=["']${escapedKey}["'][^>]*>[\\s\\S]*?<\\/span>`, "gi");
                            completeHtml = completeHtml.replace(signatureBoxRegex, replacement);
                            
                            // 7. Additional pass: Replace any remaining nested structures with multiple passes
                            let previousHtml = '';
                            let passCount = 0;
                            while (completeHtml !== previousHtml && passCount < 3) {
                                previousHtml = completeHtml;
                                passCount++;
                                
                                // Try to find and replace any remaining nested structures
                                const nestedPattern = new RegExp(`<span[^>]*>[\\s\\S]*?<span[^>]*data-signature-key=["']${escapedKey}["'][^>]*>[\\s\\S]*?<\\/span>[\\s\\S]*?<\\/span>`, "gi");
                                completeHtml = completeHtml.replace(nestedPattern, (match) => {
                                    if (match.includes(`data-signature-key="${entry.key}"`)) {
                                        // Replace inner signature box
                                        const innerReplaced = match.replace(new RegExp(`<span[^>]*data-signature-key=["']${escapedKey}["'][^>]*>[\\s\\S]*?<\\/span>`, "gi"), replacement);
                                        // Check remaining content
                                        const remainingContent = innerReplaced.replace(/^<span[^>]*>/, '').replace(/<\/span>$/, '').replace(/&nbsp;/g, ' ').trim();
                                        if (!remainingContent || remainingContent === replacement.trim() || remainingContent.length < 20) {
                                            return replacement;
                                        }
                                        return innerReplaced;
                                    }
                                    return match;
                                });
                            }
                            
                            // 7. Replace old signature data URLs if they exist
                            if (entry.value && entry.value.startsWith("data:image")) {
                                const escapedOldSrc = entry.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                                const existingImgRegex2 = new RegExp(`<img[^>]*src=["']${escapedOldSrc}["'][^>]*>`, "gi");
                                completeHtml = completeHtml.replace(existingImgRegex2, replacement);
                            }
                            
                            // Debug: Log what we're replacing
                            console.log(`Replacing signature for key: ${entry.key}`, {
                                hasValue: !!val,
                                valueLength: val ? val.length : 0,
                                htmlContainsKey: completeHtml.includes(entry.key),
                                htmlContainsSignatureBox: completeHtml.includes('signature-box'),
                                htmlContainsDataSignatureKey: completeHtml.includes(`data-signature-key="${entry.key}"`),
                                beforeReplace: completeHtml.includes(`data-signature-key="${entry.key}"`)
                            });
                            
                            // Final check: if signature box still exists, try one more aggressive replacement
                            if (completeHtml.includes(`data-signature-key="${entry.key}"`) && !completeHtml.includes(`<img[^>]*data-signature-key="${entry.key}"`)) {
                                console.warn(`Signature box still exists for ${entry.key}, attempting aggressive replacement`);
                                
                                // Try a very specific pattern for the user's format
                                // <span style="..."><span class="signature-box" data-signature="true" data-signature-key="...">--</span></span>
                                const specificNestedPattern = new RegExp(`<span[^>]*style=["'][^"']*font-size:[^"']*["'][^>]*>[\\s\\S]*?<span[^>]*class=["'][^"']*signature-box[^"']*["'][^>]*data-signature-key=["']${escapedKey}["'][^>]*>[\\s\\S]*?<\\/span>[\\s\\S]*?<\\/span>`, "gi");
                                completeHtml = completeHtml.replace(specificNestedPattern, replacement);
                                
                                // Also try replacing any parent span that ONLY contains a signature box with this key
                                // Match: <span ...><span ... data-signature-key="...">...</span> </span>
                                const parentSpanOnlyPattern = new RegExp(`<span[^>]*>[\\s\\S]*?<span[^>]*data-signature-key=["']${escapedKey}["'][^>]*>[\\s\\S]*?<\\/span>[\\s\\S]*?<\\/span>`, "gi");
                                completeHtml = completeHtml.replace(parentSpanOnlyPattern, (match) => {
                                    if (match.includes(`data-signature-key="${entry.key}"`)) {
                                        // Check if outer span only contains the signature box (and maybe whitespace)
                                        const innerBox = match.match(new RegExp(`<span[^>]*data-signature-key=["']${escapedKey}["'][^>]*>[\\s\\S]*?<\\/span>`, "i"));
                                        if (innerBox) {
                                            const remaining = match.replace(/^<span[^>]*>/, '').replace(/<\/span>$/, '').trim();
                                            const cleanedRemaining = remaining.replace(/&nbsp;/g, ' ').replace(innerBox[0], '').trim();
                                            // If only whitespace remains after removing the signature box, replace entire structure
                                            if (!cleanedRemaining || cleanedRemaining.length < 5) {
                                                return replacement;
                                            }
                                        }
                                    }
                                    return match;
                                });
                                
                                // Also try replacing any remaining signature boxes with this key
                                const aggressiveRegex = new RegExp(`<span[^>]*data-signature-key=["']${escapedKey}["'][^>]*>[\\s\\S]*?<\\/span>`, "gi");
                                completeHtml = completeHtml.replace(aggressiveRegex, replacement);
                            }
                            
                            // Clean up: Remove empty parent spans that might remain after replacement
                            // Pattern: <span ...> </span> or <span ...>\n</span> (only whitespace)
                            completeHtml = completeHtml.replace(/<span[^>]*>\s*<\/span>/gi, '');
                        }
                    } else {
                        // For non-signature variables, replace placeholders
                        const placeholder = `var[{{${entry.key}}}]`;
                        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                        const regex = new RegExp(escapedPlaceholder, "g");
                        const replacement = entry.inputValue || entry.value || placeholder;
                        completeHtml = completeHtml.replace(regex, replacement);
                    }
                });

                // Wrap in complete HTML document (similar to CollaborationAssignment)
                const completeHtmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract Document</title>
  
  <style>
    /* Base fallback styles */
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11.5pt;
      line-height: 1.7;
      color: #111827;
      word-break: break-word;
      padding: 20px;
      max-width: 100%;
      margin: 0;
      background: #ffffff;
    }
    
    .contract-preview-container {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 24px;
      border: 1px solid #e2e8f0;
      padding: 24px;
      box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
      width: 100%;
      max-width: 100%;
    }
    
    .contract-preview-container .tiptap-rendered {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11.5pt;
      line-height: 1.7;
      color: #111827;
      word-break: break-word;
      width: 100%;
      max-width: 100%;
    }
  </style>
</head>
<body>
  <div class="contract-preview-container">
    <div class="tiptap-rendered">
      ${completeHtml}
    </div>
  </div>
</body>
</html>`;

                // Update collaboration_variable_overrides table
                // Use upsert to handle both update and insert cases
                if (!collaborationId || !dbCampaignId || !dbInfluencerId) {
                    console.error("Missing required IDs for saving:", { collaborationId, dbCampaignId, dbInfluencerId });
                    toast({
                        title: "Error",
                        description: "Missing required information to save contract.",
                        variant: "destructive",
                    });
                    return;
                }

                // Prepare the update object, preserving magic_link if it exists
                const updateData: any = {
                    collaboration_id: collaborationId,
                    variable_key: "all_variables",
                    contract_html: completeHtmlDocument,
                    value: JSON.stringify(variablesMap),
                    campaign_id: dbCampaignId,
                    influencer_id: dbInfluencerId
                };

                // Preserve magic_link if it exists
                if (existingMagicLink) {
                    updateData.magic_link = existingMagicLink;
                }

                const { error } = await (supabase as any)
                    .from("collaboration_variable_overrides")
                    .upsert(updateData, {
                        onConflict: 'collaboration_id,variable_key'
                    });

                if (error) {
                    console.error("Error saving contract HTML:", error);
                    console.error("Error details:", JSON.stringify(error, null, 2));
                    console.error("Update data:", JSON.stringify(updateData, null, 2));
                    toast({
                        title: "Warning",
                        description: `Signature saved but failed to update contract HTML: ${error.message || "Unknown error"}`,
                        variant: "destructive",
                    });
                } else {
                    console.log("Successfully saved signature to database");
                    console.log("Variables map:", variablesMap);
                    // Update is_signed in collaboration_actions table
                    // Use upsert to handle both update and insert cases
                    const { error: actionError } = await (supabase as any)
                        .from("collaboration_actions")
                        .upsert({
                            collaboration_id: collaborationId,
                            campaign_id: dbCampaignId,
                            influencer_id: dbInfluencerId,
                            is_signed: true,
                            action: "signed", // Set a default action
                            occurred_at: new Date().toISOString()
                        }, {
                            onConflict: 'collaboration_id'
                        });

                    if (actionError) {
                        console.error("Error updating is_signed:", actionError);
                        console.error("Error details:", JSON.stringify(actionError, null, 2));
                        // Don't show error to user as contract is already saved, but log it
                    } else {
                        // Update local state to reflect signed status
                        setIsSigned(true);
                    }

                    toast({
                        title: "Success",
                        description: "Signature saved and contract updated!",
                    });
                }
            } catch (err: any) {
                console.error("Error saving signature:", err);
                toast({
                    title: "Error",
                    description: "Failed to save signature to database.",
                    variant: "destructive",
                });
            }
        }
    };

    const handleUpdateContract = async () => {
        // Save the contract with filled variables
        // This would update campaign_contracts table
        try {
            // Construct variables object
            const variables: Record<string, string> = {};
            contractVariableEntries.forEach(e => {
                if (e.inputValue) variables[e.key] = e.inputValue;
            });

            // Upsert contract
            const { error } = await supabase
                .from("campaign_contracts")
                .upsert({
                    campaign_id: campaign?.id,
                    influencer_id: influencer?.id,
                    contract_content: contractContent,
                    contract_variables: variables,
                    status: "signed", // Or partially_signed
                    version: 1 // simplified
                } as any, { onConflict: 'campaign_id, influencer_id' }); // Assuming constraint

            if (error) throw error;

            toast({ title: "Success", description: "Contract signed and updated!" });

        } catch (err: any) {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
    if (error) return <div className="flex h-screen items-center justify-center text-red-500">{error}</div>;

    // Email Verification Handler
    const handleEmailVerification = () => {
        setEmailError("");
        if (!enteredEmail.trim()) {
            setEmailError("Please enter your email address.");
            return;
        }
        
        const enteredEmailLower = enteredEmail.trim().toLowerCase();
        const influencerEmailLower = influencer?.email?.toLowerCase() || "";
        
        if (enteredEmailLower === influencerEmailLower) {
            setIsEmailVerified(true);
            setEmailError("");
        } else {
            setEmailError("Email does not match. Please enter the correct email address.");
        }
    };

    // Show email verification form if not verified
    if (!isEmailVerified && influencer?.email) {
        return (
            <div className="min-h-screen bg-slate-50 w-full flex items-center justify-center" style={{ width: '100vw', margin: 0, padding: 0 }}>
                <Card className="w-full max-w-md p-6 md:p-8 shadow-lg">
                    <div className="space-y-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">Email Verification</h1>
                            <p className="text-sm text-slate-500">
                                Please enter your registered email address to access the contract.
                            </p>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                value={enteredEmail}
                                onChange={(e) => {
                                    setEnteredEmail(e.target.value);
                                    setEmailError("");
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleEmailVerification();
                                    }
                                }}
                                className={emailError ? "border-red-500" : ""}
                            />
                            {emailError && (
                                <p className="text-sm text-red-500">{emailError}</p>
                            )}
                        </div>
                        
                        <Button 
                            onClick={handleEmailVerification}
                            className="w-full bg-primary text-white"
                        >
                            Verify Email
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 w-full" style={{ width: '100vw', margin: 0, padding: 0 }}>
            <Card className="w-full bg-white p-4 md:p-8 shadow-lg" style={{ width: '100%', maxWidth: '100%', margin: 0 }}>
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Contract Agreement</h1>
                        {collaborationId && (
                            <p className="text-sm font-medium text-slate-700 mt-1">
                                Collaboration ID: {collaborationId}
                            </p>
                        )}
                        <p className="text-sm text-slate-500 mt-2">
                            {isSigned ? "Contract has been signed." : "Please review and sign the contract below."}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {contractPreviewHtml && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    // Print functionality with font preservation
                                    const printWindow = window.open('', '_blank');
                                    if (printWindow && contractPreviewHtml) {
                                        // Extract body content from contractPreviewHtml
                                        let bodyContent = contractPreviewHtml;
                                        
                                        // Try to extract content from .contract-preview-container or .tiptap-rendered
                                        if (contractPreviewHtml.includes('<div class="contract-preview-container">')) {
                                            const match = contractPreviewHtml.match(/<div class="contract-preview-container">([\s\S]*?)<\/div>/i);
                                            if (match && match[1]) {
                                                bodyContent = match[1];
                                                // Try to extract from .tiptap-rendered if present
                                                if (bodyContent.includes('<div class="tiptap-rendered">')) {
                                                    const tiptapMatch = bodyContent.match(/<div class="tiptap-rendered">([\s\S]*?)<\/div>/i);
                                                    if (tiptapMatch && tiptapMatch[1]) {
                                                        bodyContent = tiptapMatch[1];
                                                    }
                                                }
                                            }
                                        }
                                        
                                        // Extract existing styles
                                        const styleMatches = contractPreviewHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
                                        const existingStyles = styleMatches.map(match => {
                                            const content = match.replace(/<\/?style[^>]*>/gi, '');
                                            return content;
                                        }).join('\n');

                                        // Create complete HTML document with Google Fonts
                                        const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract Print</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&family=Open+Sans:wght@300;400;600;700&family=Lato:wght@300;400;700&family=Montserrat:wght@300;400;500;600;700&family=Raleway:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Merriweather:wght@300;400;700&family=Source+Sans+Pro:wght@300;400;600;700&family=Poppins:wght@300;400;500;600;700&family=Nunito:wght@300;400;600;700&family=Ubuntu:wght@300;400;500;700&family=Crimson+Text:wght@400;600;700&family=Lora:wght@400;500;600;700&family=PT+Serif:wght@400;700&family=Dancing+Script:wght@400;500;600;700&family=Great+Vibes&family=Allura&family=Pacifico&family=Satisfy&family=Kalam:wght@300;400;700&family=Caveat:wght@400;500;600;700&family=Permanent+Marker&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11.5pt;
      line-height: 1.7;
      color: #111827;
      word-break: break-word;
      padding: 20px;
      max-width: 100%;
      margin: 0;
      background: #ffffff;
    }
    .contract-preview-container {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 24px;
      border: 1px solid #e2e8f0;
      padding: 24px;
      box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
      width: 100%;
      max-width: 100%;
    }
    .tiptap-rendered {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11.5pt;
      line-height: 1.7;
      color: #111827;
      word-break: break-word;
      width: 100%;
      max-width: 100%;
    }
    ${existingStyles}
    /* Ensure signature fonts are preserved in print */
    span[style*="font-family"][style*="Dancing Script"],
    span[style*="font-family"][style*="Great Vibes"],
    span[style*="font-family"][style*="Allura"],
    span[style*="font-family"][style*="Brush Script"],
    span[style*="font-family"][style*="Lucida Handwriting"],
    span[style*="font-family"][style*="Pacifico"],
    span[style*="font-family"][style*="Satisfy"],
    span[style*="font-family"][style*="Kalam"],
    span[style*="font-family"][style*="Caveat"],
    span[style*="font-family"][style*="Permanent Marker"] {
      font-family: 'Dancing Script', 'Great Vibes', 'Allura', 'Brush Script MT', 'Lucida Handwriting', 'Pacifico', 'Satisfy', 'Kalam', 'Caveat', 'Permanent Marker', cursive !important;
    }
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      body {
        padding: 0;
        margin: 0;
      }
      .contract-preview-container {
        border: none;
        box-shadow: none;
        padding: 0;
      }
      span[style*="font-family"][style*="Dancing Script"],
      span[style*="font-family"][style*="Great Vibes"],
      span[style*="font-family"][style*="Allura"],
      span[style*="font-family"][style*="Brush Script"],
      span[style*="font-family"][style*="Lucida Handwriting"],
      span[style*="font-family"][style*="Pacifico"],
      span[style*="font-family"][style*="Satisfy"],
      span[style*="font-family"][style*="Kalam"],
      span[style*="font-family"][style*="Caveat"],
      span[style*="font-family"][style*="Permanent Marker"] {
        font-family: 'Dancing Script', 'Great Vibes', 'Allura', 'Brush Script MT', 'Lucida Handwriting', 'Pacifico', 'Satisfy', 'Kalam', 'Caveat', 'Permanent Marker', cursive !important;
      }
    }
  </style>
</head>
<body>
  <div class="contract-preview-container">
    <div class="tiptap-rendered">
      ${bodyContent}
    </div>
  </div>
</body>
</html>`;

                                        printWindow.document.write(printHtml);
                                        printWindow.document.close();

                                        // Wait for fonts to load before printing
                                        printWindow.onload = () => {
                                            // Wait a bit for fonts to load
                                            setTimeout(() => {
                                                printWindow.print();
                                            }, 500);
                                        };
                                    }
                                }}
                                className="flex items-center gap-2"
                            >
                                <Printer className="h-4 w-4" />
                                Print
                            </Button>
                        )}
                        {isSigned ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="font-semibold">Contract Signed</span>
                            </div>
                        ) : (
                            <Button onClick={handleUpdateContract} className="bg-primary text-white">
                                Submit Signed Contract
                            </Button>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-8 shadow-inner min-h-[60vh] w-full overflow-x-auto" style={{ width: '100%', maxWidth: '100%' }}>
                    <div
                        ref={previewRef}
                        className="prose prose-lg max-w-none w-full"
                        style={{ maxWidth: '100%', width: '100%' }}
                        dangerouslySetInnerHTML={{ __html: contractPreviewHtml }}
                        onClick={(e) => {
                            // Fallback click handler using React events
                            const target = e.target as HTMLElement;
                            let key = target.getAttribute("data-signature-key");
                            if (!key) {
                                const parent = target.closest("[data-signature-key]");
                                if (parent) {
                                    key = parent.getAttribute("data-signature-key");
                                }
                            }
                            if (!key) {
                                const clickableElement = target.closest(".signature-box-clickable");
                                if (clickableElement) {
                                    key = clickableElement.getAttribute("data-signature-key");
                                }
                            }
                            if (key) {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log("Signature box clicked (React handler), key:", key);
                                setCurrentSignatureEntry(key);
                                setIsSignatureDialogOpen(true);
                                setSignatureMode('draw');
                            }
                        }}
                    />
                </div>
            </Card>

            {/* Signature Dialog - Copied & Simplified */}
            <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Signature</DialogTitle>
                        <DialogDescription>
                            Draw or type your signature below.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center justify-center gap-4 py-4">
                        <Button variant={signatureMode === 'draw' ? 'default' : 'outline'} onClick={() => {
                            setSignatureMode('draw');
                            // Force canvas re-initialization when switching to draw mode
                            setTimeout(() => {
                                const canvas = signatureCanvasRef.current;
                                if (canvas) {
                                    const ctx = canvas.getContext('2d');
                                    if (ctx && canvas.width > 0 && canvas.height > 0) {
                                        ctx.fillStyle = '#ffffff';
                                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                                    }
                                }
                            }, 100);
                        }}>Draw</Button>
                        <Button variant={signatureMode === 'type' ? 'default' : 'outline'} onClick={() => setSignatureMode('type')}>Type</Button>
                    </div>

                    {signatureMode === 'draw' ? (
                        <div className="space-y-3">
                            <div 
                                className="relative border-2 border-slate-300 rounded-lg bg-white overflow-hidden" 
                                style={{ 
                                    height: '200px', 
                                    width: '100%', 
                                    minWidth: '400px', 
                                    position: 'relative',
                                    backgroundColor: '#ffffff'
                                }}
                            >
                                <canvas
                                    ref={signatureCanvasRef}
                                    width={500}
                                    height={200}
                                    className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                                    style={{ 
                                        display: 'block', 
                                        visibility: 'visible',
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        zIndex: 1,
                                        backgroundColor: '#ffffff',
                                        touchAction: 'none',
                                        opacity: 1
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        const canvas = signatureCanvasRef.current;
                                        if (!canvas) return;
                                        const ctx = canvas.getContext('2d');
                                        if (!ctx) return;
                                        const rect = canvas.getBoundingClientRect();
                                        const scaleX = canvas.width / rect.width;
                                        const scaleY = canvas.height / rect.height;
                                        ctx.beginPath();
                                        ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                                        setIsDrawing(true);
                                    }}
                                    onMouseMove={(e) => {
                                        e.preventDefault();
                                        if (!isDrawing) return;
                                        const canvas = signatureCanvasRef.current;
                                        if (!canvas) return;
                                        const ctx = canvas.getContext('2d');
                                        if (!ctx) return;
                                        const rect = canvas.getBoundingClientRect();
                                        const scaleX = canvas.width / rect.width;
                                        const scaleY = canvas.height / rect.height;
                                        ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                                        ctx.stroke();
                                    }}
                                    onMouseUp={() => setIsDrawing(false)}
                                    onMouseLeave={() => setIsDrawing(false)}
                                    onTouchStart={(e) => {
                                        e.preventDefault();
                                        const canvas = signatureCanvasRef.current;
                                        if (!canvas) return;
                                        const ctx = canvas.getContext('2d');
                                        if (!ctx) return;
                                        const rect = canvas.getBoundingClientRect();
                                        const touch = e.touches[0];
                                        const scaleX = canvas.width / rect.width;
                                        const scaleY = canvas.height / rect.height;
                                        ctx.beginPath();
                                        ctx.moveTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
                                        setIsDrawing(true);
                                    }}
                                    onTouchMove={(e) => {
                                        e.preventDefault();
                                        if (!isDrawing) return;
                                        const canvas = signatureCanvasRef.current;
                                        if (!canvas) return;
                                        const ctx = canvas.getContext('2d');
                                        if (!ctx) return;
                                        const rect = canvas.getBoundingClientRect();
                                        const touch = e.touches[0];
                                        const scaleX = canvas.width / rect.width;
                                        const scaleY = canvas.height / rect.height;
                                        ctx.lineTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
                                        ctx.stroke();
                                    }}
                                    onTouchEnd={() => setIsDrawing(false)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const canvas = signatureCanvasRef.current;
                                        if (canvas) {
                                            const ctx = canvas.getContext('2d');
                                            if (ctx) {
                                                ctx.clearRect(0, 0, canvas.width, canvas.height);
                                            }
                                        }
                                    }}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Input
                                placeholder="Type your name"
                                value={signatureValue}
                                onChange={(e) => setSignatureValue(e.target.value)}
                            />
                            <Select value={signatureFont} onValueChange={setSignatureFont}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Dancing Script">Dancing Script</SelectItem>
                                    <SelectItem value="Great Vibes">Great Vibes</SelectItem>
                                    <SelectItem value="Pacifico">Pacifico</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="p-4 border rounded text-center text-2xl" style={{ fontFamily: signatureFont }}>
                                {signatureValue || "Preview"}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsSignatureDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveSignature}>Save Signature</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PublicContractSigning;

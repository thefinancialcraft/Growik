import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Pen, Type, RotateCcw, CheckCircle2 } from "lucide-react";
import { extractTokenFromUrl, extractBodyContent, extractStylesFromHtml } from "@/lib/magicLink";

const ContractSign = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [contractHtml, setContractHtml] = useState<string | null>(null);
  const [originalContractTemplate, setOriginalContractTemplate] = useState<string | null>(null);
  const [collaborationId, setCollaborationId] = useState<string | null>(null);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState<boolean>(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [signatureValue, setSignatureValue] = useState<string>("");
  const [signatureFont, setSignatureFont] = useState<string>("Dancing Script");
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);
  const [selectedSignatureIndex, setSelectedSignatureIndex] = useState<number | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState<boolean>(false);
  const [signatureBoxesStatus, setSignatureBoxesStatus] = useState<Array<{ index: number; isFilled: boolean }>>([]);

  const signatureFonts = [
    "Dancing Script",
    "Great Vibes",
    "Allura",
    "Pacifico",
    "Satisfy",
    "Kalam",
    "Caveat",
    "Permanent Marker"
  ];

  // Find signature boxes in contract HTML
  const findSignatureBoxes = (html: string): number => {
    if (!html) return 0;
    
    // Check for placeholder text
    const placeholderMatches = html.match(/var\[\{\{signature\}\}\]/g);
    const placeholderCount = placeholderMatches ? placeholderMatches.length : 0;
    
    // Check for signature box elements (class or data attribute)
    const signatureBoxMatches = html.match(/class=["'][^"']*signature-box[^"']*["']|data-signature=["']true["']/g);
    const signatureBoxCount = signatureBoxMatches ? signatureBoxMatches.length : 0;
    
    // Return the maximum count (either placeholders or rendered boxes)
    return Math.max(placeholderCount, signatureBoxCount);
  };

  // Count available (unfilled) signature boxes
  const countAvailableSignatureBoxes = (html: string): number => {
    if (!html) return 0;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const signatureBoxes = tempDiv.querySelectorAll('span.signature-box, span[data-signature="true"]');
    let availableCount = 0;
    
    signatureBoxes.forEach((box) => {
      const isFilled = box.querySelector('img') !== null || 
                      (box.textContent && box.textContent.trim() !== 'var[{{signature}}]' && box.textContent.trim() !== '');
      if (!isFilled) {
        availableCount++;
      }
    });
    
    // Also count placeholder text that's not in a box
    const textContent = tempDiv.textContent || '';
    const placeholderMatches = textContent.match(/var\[\{\{signature\}\}\]/g);
    if (placeholderMatches) {
      // Count placeholders that are not already in boxes
      const placeholderCount = placeholderMatches.length;
      const boxCount = signatureBoxes.length;
      if (placeholderCount > boxCount) {
        availableCount += (placeholderCount - boxCount);
      }
    }
    
    return availableCount;
  };

  // Get signature boxes status (filled/available)
  const getSignatureBoxesStatus = (html: string): Array<{ index: number; isFilled: boolean }> => {
    if (!html) return [];
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const signatureBoxes = tempDiv.querySelectorAll('span.signature-box, span[data-signature="true"]');
    const status: Array<{ index: number; isFilled: boolean }> = [];
    let index = 0;
    
    signatureBoxes.forEach((box) => {
      const isFilled = box.querySelector('img') !== null || 
                      (box.textContent && box.textContent.trim() !== 'var[{{signature}}]' && box.textContent.trim() !== '');
      status.push({ index, isFilled });
      index++;
    });
    
    // Also check for placeholder text that's not in a box
    const textContent = tempDiv.textContent || '';
    const placeholderMatches = textContent.match(/var\[\{\{signature\}\}\]/g);
    if (placeholderMatches) {
      const placeholderCount = placeholderMatches.length;
      const boxCount = signatureBoxes.length;
      if (placeholderCount > boxCount) {
        // Add remaining placeholders as available
        for (let i = boxCount; i < placeholderCount; i++) {
          status.push({ index: i, isFilled: false });
        }
      }
    }
    
    return status;
  };

  // Process contract HTML to mark signature boxes
  const processContractHtml = (html: string): string => {
    if (!html) return html;
    
    // Create a temporary DOM element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Find all signature boxes (placeholders and rendered boxes)
    const signaturePlaceholders = tempDiv.querySelectorAll('span.signature-box, span[data-signature="true"]');
    const textContent = tempDiv.textContent || '';
    const placeholderMatches = textContent.match(/var\[\{\{signature\}\}\]/g);
    
    let index = 0;
    
    // Process rendered signature boxes
    signaturePlaceholders.forEach((box) => {
      const isFilled = box.querySelector('img') !== null || 
                      (box.textContent && box.textContent.trim() !== 'var[{{signature}}]' && box.textContent.trim() !== '');
      
      if (isFilled) {
        // Make filled boxes dull/greyed out
        (box as HTMLElement).style.opacity = '0.5';
        (box as HTMLElement).style.pointerEvents = 'none';
        (box as HTMLElement).style.cursor = 'not-allowed';
      } else {
        // Mark available boxes as clickable
        (box as HTMLElement).style.cursor = 'pointer';
        (box as HTMLElement).style.transition = 'all 0.2s';
        (box as HTMLElement).setAttribute('data-signature-index', index.toString());
        (box as HTMLElement).setAttribute('data-clickable', 'true');
        (box as HTMLElement).classList.add('signature-box-clickable');
        index++;
      }
    });
    
    // Process placeholder text (var[{{signature}}])
    if (placeholderMatches) {
      const walker = document.createTreeWalker(
        tempDiv,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent && node.textContent.includes('var[{{signature}}]')) {
          const parent = node.parentElement;
          if (parent && !parent.classList.contains('signature-box') && !parent.hasAttribute('data-signature')) {
            // Create a clickable signature box wrapper
            const wrapper = document.createElement('span');
            wrapper.className = 'signature-box signature-box-clickable';
            wrapper.setAttribute('data-signature', 'true');
            wrapper.setAttribute('data-signature-index', index.toString());
            wrapper.setAttribute('data-clickable', 'true');
            wrapper.style.cssText = 'display: inline-block; width: 200px; height: 140px; border: 1px solid #9ca3af; background-color: transparent; border-radius: 3px; padding: 2px; text-align: center; vertical-align: middle; line-height: 136px; font-size: 10px; color: #6b7280; box-sizing: border-box; margin: 20px 25px; cursor: pointer; transition: all 0.2s;';
            wrapper.textContent = 'var[{{signature}}]';
            
            node.textContent = node.textContent.replace('var[{{signature}}]', '');
            parent.insertBefore(wrapper, node);
            index++;
          }
        }
      }
    }
    
    return tempDiv.innerHTML;
  };

  // Attach event listeners to signature boxes after render
  useEffect(() => {
    if (!contractHtml) return;
    
    const contractContainer = document.querySelector('.tiptap-rendered');
    if (!contractContainer) return;
    
    const clickableBoxes = contractContainer.querySelectorAll('.signature-box-clickable[data-clickable="true"]');
    const cleanupFunctions: Array<() => void> = [];
    
    clickableBoxes.forEach((box) => {
      const index = parseInt((box as HTMLElement).getAttribute('data-signature-index') || '-1');
      if (index === -1) return;
      
      // Add hover effect
      const handleMouseEnter = () => {
        (box as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
      };
      const handleMouseLeave = () => {
        (box as HTMLElement).style.backgroundColor = 'transparent';
      };
      const handleClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedSignatureIndex(index);
        setIsSignatureDialogOpen(true);
      };
      
      box.addEventListener('mouseenter', handleMouseEnter);
      box.addEventListener('mouseleave', handleMouseLeave);
      box.addEventListener('click', handleClick);
      
      // Store cleanup function
      cleanupFunctions.push(() => {
        box.removeEventListener('mouseenter', handleMouseEnter);
        box.removeEventListener('mouseleave', handleMouseLeave);
        box.removeEventListener('click', handleClick);
      });
    });
    
    // Return cleanup function
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [contractHtml]);

  // Initialize and reset canvas when dialog opens/closes
  useEffect(() => {
    if (!isSignatureDialogOpen) {
      // Reset drawing state when dialog closes
      setIsDrawing(false);
      setSignatureMode('draw');
      setSignatureValue('');
    } else {
      // Initialize canvas when dialog opens - use setTimeout to ensure DOM is ready
      const timer = setTimeout(() => {
        if (signatureCanvasRef.current) {
          const canvas = signatureCanvasRef.current;
          const rect = canvas.getBoundingClientRect();
          const ctx = canvas.getContext('2d');
          if (ctx && rect.width > 0 && rect.height > 0) {
            // Only set dimensions if canvas is empty or dimensions changed
            // Setting width/height clears the canvas, so we check if it's already initialized
            if (canvas.width === 0 || canvas.height === 0 || 
                (canvas.width !== rect.width || canvas.height !== rect.height)) {
              canvas.width = rect.width;
              canvas.height = rect.height;
              // Reconfigure context after resize
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 2;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
            } else {
              // Just update context settings without clearing
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 2;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
            }
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSignatureDialogOpen]);

  // Load contract from magic link
  useEffect(() => {
    const loadContract = async () => {
      if (!token) {
        toast({
          title: "Invalid Link",
          description: "Magic link token is missing.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      try {
        // Find collaboration_actions entry by magic_link (contains the token)
        const magicLinkUrl = `${window.location.origin}/contract-sign/${token}`;
        const { data: actionData, error: actionError } = await supabase
          .from("collaboration_actions")
          .select("collaboration_id, contract_id")
          .eq("magic_link", magicLinkUrl)
          .maybeSingle();

        if (actionError || !actionData) {
          toast({
            title: "Contract Not Found",
            description: "Invalid or expired magic link.",
            variant: "destructive",
          });
          navigate("/");
          return;
        }
        
        const actionDataTyped = actionData as { collaboration_id: string; contract_id?: string | null } | null;
        if (!actionDataTyped?.collaboration_id) {
          toast({
            title: "Contract Not Found",
            description: "Invalid collaboration data.",
            variant: "destructive",
          });
          navigate("/");
          return;
        }

        setCollaborationId(actionDataTyped.collaboration_id);

        // Load contract HTML from collaboration_variable_overrides
        const { data: overrideData, error: overrideError } = await supabase
          .from("collaboration_variable_overrides")
          .select("contract_html")
          .eq("collaboration_id", actionDataTyped.collaboration_id)
          .maybeSingle();

        const overrideDataTyped = overrideData as { contract_html?: string | null } | null;
        if (overrideError || !overrideDataTyped?.contract_html) {
          toast({
            title: "Contract Not Found",
            description: "Contract content not available.",
            variant: "destructive",
          });
          return;
        }

        const loadedHtml = overrideDataTyped.contract_html;
        setContractHtml(loadedHtml);
        
        // Extract original template by restoring var[{{signature}}] placeholders
        // This ensures we have a clean template for signature replacement
        let originalTemplate = loadedHtml;
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(loadedHtml, "text/html");
          const bodyContent = doc.body?.querySelector('.tiptap-rendered')?.innerHTML || 
                            doc.body?.innerHTML || 
                            loadedHtml;
          
          // Try to restore placeholders from signature boxes
          // If signature boxes exist, replace them with placeholders to get original template
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = bodyContent;
          
          // Replace filled signature boxes with placeholders
          const signatureBoxes = tempDiv.querySelectorAll('span.signature-box, span[data-signature="true"], img[alt="Signature"], span[style*="font-family"][style*="Dancing Script"], span[style*="font-family"][style*="Great Vibes"]');
          signatureBoxes.forEach((box) => {
            const placeholder = document.createTextNode('var[{{signature}}]');
            box.parentNode?.replaceChild(placeholder, box);
          });
          
          originalTemplate = tempDiv.innerHTML;
        } catch (e) {
          // If parsing fails, try to restore placeholders using regex
          // Replace signature images and text with placeholders
          originalTemplate = loadedHtml
            .replace(/<img[^>]*alt=["']Signature["'][^>]*>/gi, 'var[{{signature}}]')
            .replace(/<span[^>]*style[^>]*font-family[^>]*Dancing Script[^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
            .replace(/<span[^>]*style[^>]*font-family[^>]*Great Vibes[^>]*>.*?<\/span>/gi, 'var[{{signature}}]');
        }
        
        setOriginalContractTemplate(originalTemplate);
      } catch (error: any) {
        console.error("ContractSign: Error loading contract", error);
        toast({
          title: "Error",
          description: error?.message || "Failed to load contract.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadContract();
  }, [token, navigate, toast]);

  // Handle signature drawing
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
  };

  const handleCanvasMouseUp = () => setIsDrawing(false);
  const handleCanvasMouseLeave = () => setIsDrawing(false);

  // Clear signature
  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureValue("");
  };


  // Escape HTML function (exactly like CollaborationAssignment)
  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // Replace signature in contract HTML (exactly like CollaborationAssignment - using regex sequential replacement)
  const replaceSignatureInContract = (html: string, signatureValue: string, index: number): string => {
    if (!html) return html;
    
    const placeholder = "var[{{signature}}]";
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedPlaceholder, "g");
    
    // Count total occurrences first
    const matches = html.match(regex);
    const totalOccurrences = matches ? matches.length : 0;
    
    console.log(`ContractSign: replaceSignatureInContract called`, {
      index,
      totalOccurrences,
      htmlLength: html.length,
      signatureValueLength: signatureValue?.length || 0,
      isImage: signatureValue?.startsWith("data:image") || false
    });
    
    if (totalOccurrences === 0) {
      console.warn(`ContractSign: No placeholder found in HTML for signature index ${index}`);
      return html;
    }
    
    if (index >= totalOccurrences) {
      console.warn(`ContractSign: Index ${index} is out of range. Total occurrences: ${totalOccurrences}`);
      return html;
    }
    
    let occurrenceIndex = 0;
    
    // Replace each signature occurrence sequentially (exactly like CollaborationAssignment)
    const result = html.replace(regex, (match) => {
      if (occurrenceIndex === index) {
        occurrenceIndex++;
        
        let displayHtml = "";
        
        if (signatureValue && signatureValue !== "--") {
          // Check if it's an image data URL (drawn signature)
          if (signatureValue.startsWith("data:image")) {
            // Display as image (exactly like CollaborationAssignment)
            displayHtml = `<img src="${signatureValue}" alt="Signature" style="display: inline-block; max-width: 200px; max-height: 80px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;" />`;
          } else {
            // Display as text with signature font styling (exactly like CollaborationAssignment)
            const sanitizedText = escapeHtml(signatureValue);
            displayHtml = `<span style="display: inline-block; font-family: '${signatureFont}', 'Dancing Script', 'Great Vibes', 'Allura', 'Brush Script MT', 'Lucida Handwriting', 'Pacifico', 'Satisfy', 'Kalam', 'Caveat', 'Permanent Marker', cursive; font-size: 24px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;">${sanitizedText}</span>`;
          }
        } else {
          // Show placeholder box with signature box styling - keep var[{{signature}}] as is
          // Use only class, let CSS handle all styling to avoid nested boxes
          displayHtml = `<span class="signature-box" data-signature="true">var[{{signature}}]</span>`;
        }
        
        console.log(`ContractSign: Replaced placeholder at index ${index}`, {
          match,
          displayHtmlLength: displayHtml.length,
          displayHtmlPreview: displayHtml.substring(0, 100)
        });
        
        return displayHtml;
      }
      occurrenceIndex++;
      return match;
    });
    
    console.log(`ContractSign: Replacement complete`, {
      originalLength: html.length,
      resultLength: result.length,
      changed: html !== result,
      remainingPlaceholders: (result.match(regex) || []).length
    });
    
    return result;
  };

  // Handle signing contract
  const handleSignContract = async () => {
    // Capture signature from canvas if in draw mode
    let finalSignatureValue = signatureValue;
    if (signatureMode === 'draw' && signatureCanvasRef.current && !signatureValue) {
      const canvas = signatureCanvasRef.current;
      if (canvas.width > 0 && canvas.height > 0) {
        finalSignatureValue = canvas.toDataURL('image/png');
      }
    }

    if (!contractHtml || !collaborationId || !finalSignatureValue) {
      toast({
        title: "Missing Information",
        description: "Please add your signature before signing.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Replace signature box at selected index (or first one if none selected)
      const targetIndex = selectedSignatureIndex !== null ? selectedSignatureIndex : 0;
      
      // Load existing variables from database FIRST to preserve all existing signatures
      let existingVariablesMap: Record<string, string | null> = {};
      try {
        const { data: existingOverride } = await supabase
          .from("collaboration_variable_overrides")
          .select("value")
          .eq("collaboration_id", collaborationId)
          .eq("variable_key", "all_variables")
          .maybeSingle();
        
        const existingOverrideTyped = existingOverride as { value?: string | null } | null;
        if (existingOverrideTyped && existingOverrideTyped.value) {
          try {
            existingVariablesMap = JSON.parse(existingOverrideTyped.value);
          } catch (e) {
            console.error("ContractSign: Failed to parse existing variables", e);
          }
        }
      } catch (err) {
        console.error("ContractSign: Error loading existing variables", err);
      }
      
      // Prepare variables map (merge existing with new signature)
      const variablesMap: Record<string, string | null> = { ...existingVariablesMap };
      const signatureKey = `signature_${targetIndex}`;
      variablesMap[signatureKey] = finalSignatureValue;
      
      // Extract body content from original contract template (before any signatures) to get clean template
      // Use originalContractTemplate if available, otherwise fallback to contractHtml
      let htmlToProcess = originalContractTemplate || contractHtml;
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlToProcess, "text/html");
        const extractedBody = doc.body?.querySelector('.tiptap-rendered')?.innerHTML || 
                          doc.body?.innerHTML || 
                          htmlToProcess;
        // If we extracted body content, use it; otherwise use original
        if (extractedBody !== htmlToProcess) {
          htmlToProcess = extractedBody;
        }
      } catch (e) {
        // If parsing fails, use original HTML
        htmlToProcess = originalContractTemplate || contractHtml;
      }
      
      // If originalContractTemplate is not available, try to extract from current contractHtml
      // by replacing existing signatures with placeholders
      if (!originalContractTemplate && htmlToProcess) {
        // Replace existing signature images and text with placeholders to get clean template
        htmlToProcess = htmlToProcess
          .replace(/<img[^>]*alt=["']Signature["'][^>]*>/gi, 'var[{{signature}}]')
          .replace(/<span[^>]*style[^>]*font-family[^>]*Dancing Script[^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
          .replace(/<span[^>]*style[^>]*font-family[^>]*Great Vibes[^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
          .replace(/<span[^>]*style[^>]*font-family[^>]*Allura[^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
          .replace(/<span[^>]*style[^>]*font-family[^>]*Pacifico[^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
          .replace(/<span[^>]*style[^>]*font-family[^>]*Satisfy[^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
          .replace(/<span[^>]*style[^>]*font-family[^>]*Kalam[^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
          .replace(/<span[^>]*style[^>]*font-family[^>]*Caveat[^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
          .replace(/<span[^>]*style[^>]*font-family[^>]*Permanent Marker[^>]*>.*?<\/span>/gi, 'var[{{signature}}]');
      }
      
      // Apply ALL signatures (existing + new) to the HTML
      let updatedBodyContent = htmlToProcess;
      const signatureKeys = Object.keys(variablesMap).filter(key => key.startsWith('signature_'));
      signatureKeys.sort((a, b) => {
        const indexA = parseInt(a.replace('signature_', ''));
        const indexB = parseInt(b.replace('signature_', ''));
        return indexA - indexB;
      });
      
      console.log("ContractSign: Applying signatures", {
        signatureKeys,
        htmlToProcessLength: htmlToProcess.length,
        placeholderCount: (htmlToProcess.match(/var\[\{\{signature\}\}\]/g) || []).length
      });
      
      // Apply each signature to its corresponding index
      signatureKeys.forEach((key) => {
        const index = parseInt(key.replace('signature_', ''));
        const signatureValue = variablesMap[key];
        if (signatureValue && signatureValue !== "--") {
          const beforeLength = updatedBodyContent.length;
          updatedBodyContent = replaceSignatureInContract(updatedBodyContent, signatureValue, index);
          const afterLength = updatedBodyContent.length;
          console.log(`ContractSign: Applied signature_${index}`, {
            index,
            signatureLength: signatureValue.length,
            isImage: signatureValue.startsWith("data:image"),
            beforeLength,
            afterLength,
            changed: beforeLength !== afterLength
          });
        }
      });
      
      console.log("ContractSign: Final updated body content", {
        length: updatedBodyContent.length,
        hasSignatures: updatedBodyContent.includes('<img') || updatedBodyContent.includes('font-family'),
        placeholderCount: (updatedBodyContent.match(/var\[\{\{signature\}\}\]/g) || []).length
      });
      
      
      // Extract styles and links from original contract HTML
      const extractedStylesData = extractStylesFromHtml(contractHtml);
      const extractedLinks = extractedStylesData.links || "";
      
      // Extract style tags from the original HTML string
      const styleRegex = /<style[^>]*>[\s\S]*?<\/style>/gi;
      const styleMatches = contractHtml.match(styleRegex);
      const extractedStyleTags = styleMatches ? styleMatches.join("\n") : "";
      
      // Use the updated body content with all signatures applied
      const bodyContent = updatedBodyContent;
      
      // Wrap in complete HTML document structure with all styles preserved (similar to CollaborationAssignment)
      const completeHtmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract Document</title>
  ${extractedLinks}
  <style>
    /* Base fallback styles */
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11.5pt;
      line-height: 1.7;
      color: #111827;
      word-break: break-word;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
    }
    
    .contract-preview-container {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 24px;
      border: 1px solid #e2e8f0;
      padding: 24px;
      box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
    }
    
    
    .contract-preview-container .tiptap-rendered {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11.5pt;
      line-height: 1.7;
      color: #111827;
      word-break: break-word;
    }
    
    /* Prevent signature boxes from wrapping to new line - match editor styling (exactly like CollaborationAssignment) */
    .contract-preview-container .tiptap-rendered .signature-box,
    .contract-preview-container .tiptap-rendered [data-signature="true"] {
      display: inline-block !important;
      width: 200px !important;
      height: 140px !important;
      border: 1px solid #9ca3af !important;
      background-color: transparent !important;
      border-radius: 3px !important;
      padding: 2px !important;
      text-align: center !important;
      vertical-align: middle !important;
      line-height: 136px !important;
      font-size: 10px !important;
      color: #6b7280 !important;
      box-sizing: border-box !important;
      margin-top: 20px !important;
      margin-bottom: 20px !important;
      margin-left: 25px !important;
      margin-right: 25px !important;
      min-width: 200px !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
    }
    
    /* Ensure spacing between adjacent signature boxes */
    .contract-preview-container .tiptap-rendered .signature-box + .signature-box,
    .contract-preview-container .tiptap-rendered [data-signature="true"] + [data-signature="true"] {
      margin-left: 50px !important;
    }
    
    /* Prevent parent containers from wrapping signature boxes - allow inline flow */
    .contract-preview-container .tiptap-rendered p {
      white-space: pre-wrap !important;
      overflow-wrap: break-word;
      word-wrap: break-word;
    }
    
    /* Force signature boxes to stay on same line by preventing wrapping */
    .contract-preview-container .tiptap-rendered span.signature-box,
    .contract-preview-container .tiptap-rendered span[data-signature="true"] {
      float: none !important;
      clear: none !important;
      display: inline-block !important;
    }
    
    /* Ensure parent paragraphs with signature boxes don't wrap them */
    .contract-preview-container .tiptap-rendered p {
      display: block !important;
      line-height: 1.7 !important;
    }
    
    /* Prevent wrapping of signature boxes - use nowrap on parent when it contains signature boxes */
    .contract-preview-container .tiptap-rendered span:has(.signature-box),
    .contract-preview-container .tiptap-rendered span:has([data-signature="true"]) {
      white-space: nowrap !important;
      display: inline-block !important;
    }
    
    /* Alternative: prevent wrapping by ensuring parent span doesn't break */
    .contract-preview-container .tiptap-rendered span[style*="font-size: 10px"] {
      white-space: nowrap !important;
      display: inline-block !important;
    }
    
    /* Ensure signature boxes don't wrap by making parent container wider if needed */
    .contract-preview-container {
      min-width: 0 !important;
      overflow-x: auto !important;
    }
    
    /* Ensure parent divs don't break signature boxes */
    .contract-preview-container .tiptap-rendered div {
      white-space: normal !important;
    }
    
    /* Signature box with image or text content */
    .contract-preview-container .tiptap-rendered .signature-box img,
    .contract-preview-container .tiptap-rendered [data-signature="true"] img {
      display: inline-block !important;
      max-width: 200px !important;
      max-height: 136px !important;
      margin: 0 auto !important;
      vertical-align: middle !important;
    }
    
    .contract-preview-container .tiptap-rendered .signature-box span[style*="font-family"],
    .contract-preview-container .tiptap-rendered [data-signature="true"] span[style*="font-family"] {
      display: inline-block !important;
      vertical-align: middle !important;
      line-height: normal !important;
    }
    
    ${extractedStyleTags}
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
      
      // Update collaboration_variable_overrides with signed contract (similar to CollaborationAssignment)
      // For same collaboration_id, update contract_html and variables value
      const client = supabase as any;
      
      // First, check if record exists for this collaboration_id
      const { data: existingRecord, error: checkError } = await client
        .from("collaboration_variable_overrides")
        .select("collaboration_id, variable_key, value, contract_html")
        .eq("collaboration_id", collaborationId)
        .eq("variable_key", "all_variables")
        .maybeSingle();
      
      if (checkError) {
        console.error("ContractSign: Error checking existing record", checkError);
      }
      
      const singleOverrideRecord = {
        collaboration_id: collaborationId,
        variable_key: "all_variables",
        value: JSON.stringify(variablesMap),
        contract_html: completeHtmlDocument,
      };

      // Use upsert to update or insert - this will update existing record for same collaboration_id
      const { error: updateError } = await client
        .from("collaboration_variable_overrides")
        .upsert(singleOverrideRecord, { 
          onConflict: "collaboration_id,variable_key" 
        });

      if (updateError) {
        console.error("ContractSign: Failed to upsert variable overrides", updateError);
        throw updateError;
      }
      
      console.log("ContractSign: Successfully updated collaboration_variable_overrides", {
        collaboration_id: collaborationId,
        variable_key: "all_variables",
        variablesCount: Object.keys(variablesMap).length,
        contractHtmlLength: completeHtmlDocument.length,
        wasExisting: !!existingRecord
      });

      // Update collaboration_actions to mark as signed
      const { error: signError } = await client
        .from("collaboration_actions")
        .update({ is_signed: true })
        .eq("collaboration_id", collaborationId);

      if (signError) {
        console.error("ContractSign: Failed to update signed status", signError);
      }

      setSigned(true);
      
      // Update contract HTML with complete document
      console.log("ContractSign: Updating contractHtml state", {
        completeHtmlDocumentLength: completeHtmlDocument.length,
        hasSignatures: completeHtmlDocument.includes('<img') || completeHtmlDocument.includes('font-family'),
        placeholderCount: (completeHtmlDocument.match(/var\[\{\{signature\}\}\]/g) || []).length
      });
      
      setContractHtml(completeHtmlDocument);
      setSelectedSignatureIndex(null);
      setSignatureValue("");
      
      // Close signature dialog
      setIsSignatureDialogOpen(false);
      
      console.log("ContractSign: Contract updated with signature", {
        targetIndex,
        signatureLength: finalSignatureValue.length,
        isImage: finalSignatureValue.startsWith("data:image"),
        completeHtmlDocumentLength: completeHtmlDocument.length
      });
      
      toast({
        title: "Contract Signed",
        description: "Your signature has been successfully added to the contract.",
      });
    } catch (error: any) {
      console.error("ContractSign: Error signing contract", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to sign contract.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-slate-500">Loading contract...</p>
        </div>
      </div>
    );
  }

  if (!contractHtml) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="p-6 max-w-md">
          <h2 className="text-xl font-semibold mb-2">Contract Not Found</h2>
          <p className="text-sm text-slate-500 mb-4">
            The contract you're looking for is not available.
          </p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </Card>
      </div>
    );
  }

  const signatureCount = findSignatureBoxes(contractHtml);

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <div className="w-full px-4 py-4 flex-1 flex flex-col min-h-0">
        <Card className="p-6 flex-1 flex flex-col min-h-0">
          <div className="mb-4 flex-shrink-0">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Contract Signing</h1>
            <p className="text-sm text-slate-500">
              Please review the contract and add your signature to proceed.
            </p>
          </div>

          {signed && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-sm text-green-800">Contract signed successfully!</span>
            </div>
          )}

          {/* Contract Preview */}
          <div className="contract-preview-container rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-inner mb-4 w-full flex-1 overflow-auto min-h-0">
            {(() => {
              const { css } = extractStylesFromHtml(contractHtml);
              // Override max-width constraints to allow full width
              const modifiedCss = css ? css.replace(/max-width:\s*800px/g, 'max-width: 100%') : '';
              
              // Extract body content for display
              const bodyContent = extractBodyContent(contractHtml);
              
              // Debug logging
              if (contractHtml) {
                console.log("ContractSign: Rendering contract preview", {
                  contractHtmlLength: contractHtml.length,
                  bodyContentLength: bodyContent.length,
                  hasSignatures: bodyContent.includes('<img') || bodyContent.includes('font-family'),
                  placeholderCount: (bodyContent.match(/var\[\{\{signature\}\}\]/g) || []).length,
                  signed
                });
              }
              
              return (
                <>
                  {modifiedCss && (
                    <style dangerouslySetInnerHTML={{ __html: modifiedCss }} />
                  )}
                  <style>{`
                    .contract-preview-container .tiptap-rendered,
                    .contract-preview-container body {
                      max-width: 100% !important;
                      width: 100% !important;
                    }
                    .contract-preview-container {
                      width: 100% !important;
                      max-width: 100% !important;
                    }
                    /* Ensure signature images and text are visible */
                    .contract-preview-container .tiptap-rendered img[alt="Signature"] {
                      display: inline-block !important;
                      max-width: 200px !important;
                      max-height: 80px !important;
                      margin-top: 20px !important;
                      margin-bottom: 20px !important;
                      vertical-align: middle !important;
                    }
                    .contract-preview-container .tiptap-rendered span[style*="font-family"] {
                      display: inline-block !important;
                      vertical-align: middle !important;
                    }
                  `}</style>
                  <div
                    className="tiptap-rendered"
                    dangerouslySetInnerHTML={{
                      __html: bodyContent,
                    }}
                  />
                </>
              );
            })()}
          </div>

          {/* Signature Section */}
          {signatureCount > 0 && !signed && (
            <div className="flex-shrink-0">
              <Button
                onClick={() => {
                  // Check signature boxes and show preview dialog
                  if (!contractHtml) {
                    toast({
                      title: "No Contract",
                      description: "Contract content not available.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  const status = getSignatureBoxesStatus(contractHtml);
                  setSignatureBoxesStatus(status);
                  
                  if (status.length > 0) {
                    setIsPreviewDialogOpen(true);
                  } else {
                    toast({
                      title: "No Signature Required",
                      description: "This contract does not require a signature.",
                      variant: "destructive",
                    });
                  }
                }}
                className="w-full"
                size="lg"
              >
                <Pen className="mr-2 h-4 w-4" />
                Sign Contract
              </Button>
              {signatureValue && (
                <div className="mt-4 p-4 border-2 border-slate-300 rounded-lg bg-white flex items-center justify-center" style={{ minHeight: '100px' }}>
                  {signatureValue.startsWith("data:image") ? (
                    <img src={signatureValue} alt="Your Signature" style={{ maxWidth: '200px', maxHeight: '80px' }} />
                  ) : (
                    <span style={{ fontFamily: signatureFont, fontSize: '24px' }}>
                      {signatureValue}
                    </span>
                  )}
                </div>
              )}
              {signatureValue && (
                <Button
                  onClick={handleSignContract}
                  disabled={saving}
                  className="w-full mt-4"
                  size="lg"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Submit Signature
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {signatureCount === 0 && !signed && (
            <div className="p-4 bg-slate-50 rounded-lg flex-shrink-0">
              <p className="text-sm text-slate-600">
                This contract does not require a signature.
              </p>
            </div>
          )}

          {signed && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg flex-shrink-0">
              <p className="text-sm text-slate-600">
                Thank you for signing the contract. Your signature has been recorded.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Signature Boxes Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Signature Boxes Status</DialogTitle>
            <DialogDescription>
              {signatureBoxesStatus.length} signature box{signatureBoxesStatus.length > 1 ? 'es' : ''} found. Click on an available box to sign.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              {signatureBoxesStatus.map((box) => (
                <div
                  key={box.index}
                  onClick={() => {
                    if (!box.isFilled) {
                      setSelectedSignatureIndex(box.index);
                      setIsPreviewDialogOpen(false);
                      setTimeout(() => {
                        setIsSignatureDialogOpen(true);
                      }, 100);
                    }
                  }}
                  className={`
                    p-4 border-2 rounded-lg text-center transition-all
                    ${box.isFilled 
                      ? 'border-slate-300 bg-slate-100 opacity-50 cursor-not-allowed' 
                      : 'border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 cursor-pointer'
                    }
                  `}
                  style={{
                    minHeight: '120px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  <div className="text-sm font-semibold mb-2">
                    Signature Box {box.index + 1}
                  </div>
                  {box.isFilled ? (
                    <div className="text-xs text-slate-500">
                      ✓ Signed
                    </div>
                  ) : (
                    <div className="text-xs text-blue-600 font-medium">
                      Click to Sign
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Signature</DialogTitle>
            <DialogDescription>
              Choose how you want to add your signature: draw it or type it.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Mode Selection */}
            <div className="flex gap-2">
              <Button
                variant={signatureMode === 'draw' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setSignatureMode('draw')}
              >
                <Pen className="mr-2 h-4 w-4" />
                Draw
              </Button>
              <Button
                variant={signatureMode === 'type' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setSignatureMode('type')}
              >
                <Type className="mr-2 h-4 w-4" />
                Type
              </Button>
            </div>

            {/* Draw Mode */}
            {signatureMode === 'draw' && (
              <div className="space-y-3">
                <div className="relative border-2 border-slate-300 rounded-lg bg-white" style={{ height: '200px' }}>
                  <canvas
                    ref={signatureCanvasRef}
                    className="absolute inset-0 w-full h-full cursor-crosshair"
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseLeave}
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
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {/* Type Mode */}
            {signatureMode === 'type' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Signature Font</label>
                  <Select value={signatureFont} onValueChange={setSignatureFont}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {signatureFonts.map((font) => (
                        <SelectItem key={font} value={font}>
                          {font}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Signature Text</label>
                  <Input
                    placeholder="Enter your signature"
                    value={signatureValue}
                    onChange={(e) => setSignatureValue(e.target.value)}
                    style={{
                      fontFamily: signatureFont,
                      fontSize: '24px',
                      fontWeight: 'normal',
                    }}
                  />
                  <p className="text-xs text-slate-500 mt-2" style={{ fontFamily: signatureFont, fontSize: '20px' }}>
                    Preview: {signatureValue || 'Your signature will appear here'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsSignatureDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                let finalValue = signatureValue;
                
                if (signatureMode === 'draw') {
                  const canvas = signatureCanvasRef.current;
                  if (canvas && canvas.width > 0 && canvas.height > 0) {
                    finalValue = canvas.toDataURL('image/png');
                  }
                }
                
                if (finalValue) {
                  setSignatureValue(finalValue);
                }
                setIsSignatureDialogOpen(false);
              }}
              disabled={signatureMode === 'draw' ? !signatureCanvasRef.current : !signatureValue}
            >
              Save Signature
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractSign;

